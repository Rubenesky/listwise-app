# Input Enriquecido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user attach a URL (via an optional CSV column) or a supplier PDF (via a per-listing action) as extra context for AI generation, on top of `productName + category + attributes`.

**Architecture:** Reuse the SSRF-safe URL validation, rate-limit, and cache-with-expiry patterns already proven in the competitor-analysis feature. Two independent entry points — a CSV column (`sourceUrl`, processed inside the existing `process-batch` Trigger.dev job) and a per-listing PDF action (two new REST endpoints: extract-preview, then confirm-and-regenerate) — both funnel into a shared "structured extraction + attribute-merge-with-precedence" pipeline so the raw source text never reaches the main generation prompt directly.

**Tech Stack:** Next.js API routes, Drizzle/Turso, Trigger.dev v4, cheerio (HTML), `pdf-parse` (new dependency, PDF text), Groq (cheap structured-extraction call), Jest/ts-jest.

## Global Constraints

- Every new/modified file must pass `npx tsc --noEmit`, `npm run lint`, and `npx jest --silent` before each commit.
- No merge to `main` as part of this plan — implement on `feature/input-enriquecido` branched from `staging`, fast-forward merge to `staging` only.
- `drizzle/0003_add_enriched_sources.sql` must be applied via Turso CLI to `listwise-db` **before** deploying any code from Task 3 onward — same ordering rule as `drizzle/0002_add_generation_mode.sql`.
- `pdf-parse` pin: exact version `1.1.4` (last stable 1.x release, `minor` dist-tag) — the 2.x line is a recent rewrite with far less production mileage; matches this project's existing practice of pinning exact versions for new dependencies (see `trigger.dev@4.5.7`).
- Scanned/image PDFs (no extractable text) are explicitly out of scope — see Task 5's exact heuristic and Task 13's exact user-facing error copy.
- URL rate limiting is checked **per CSV row with a `sourceUrl`**, not once per upload request (spec-approved decision — see Task 11).
- Manual `attributes` (from the CSV) always win over extracted specs on key conflict — see Task 7.

---

### Task 1: Extract SSRF validation into a shared module

**Files:**
- Create: `src/lib/security/ssrf.ts`
- Modify: `src/app/api/competitor/analyze/route.ts` (remove the inline `isPrivateIPv4`/`isPrivateIPv6`/`validateUrlSSRF` definitions, import from the new module instead)
- Test: `__tests__/unit/ssrf.test.ts`

**Interfaces:**
- Produces: `validateUrlSSRF(raw: string): Promise<{ ok: boolean; error?: string; normalized?: string }>` — used by Task 11 (upload route) and Task 13 is PDF-only so does not need it.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/ssrf.test.ts
import { validateUrlSSRF } from "@/lib/security/ssrf";

describe("validateUrlSSRF", () => {
  it("rejects non-http(s) schemes", async () => {
    const result = await validateUrlSSRF("ftp://example.com/file");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost", async () => {
    const result = await validateUrlSSRF("http://localhost/admin");
    expect(result.ok).toBe(false);
  });

  it("rejects raw private IPv4 addresses", async () => {
    const result = await validateUrlSSRF("http://192.168.1.1/");
    expect(result.ok).toBe(false);
  });

  it("rejects cloud metadata IP", async () => {
    const result = await validateUrlSSRF("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed URLs", async () => {
    const result = await validateUrlSSRF("not a url");
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed public https URL", async () => {
    const result = await validateUrlSSRF("https://example.com/product/123");
    expect(result.ok).toBe(true);
    expect(result.normalized).toBe("https://example.com/product/123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/ssrf.test.ts`
Expected: FAIL with "Cannot find module '@/lib/security/ssrf'"

- [ ] **Step 3: Create the shared module**

```ts
// src/lib/security/ssrf.ts
import { promises as dns, LookupAddress } from "dns";
import { log } from "@/lib/logger";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 255
  );
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true;
  if (/^f[cd]/i.test(norm)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/i.test(norm)) return true; // fe80::/10 link-local
  const v4mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);
  return false;
}

export async function validateUrlSSRF(
  raw: string
): Promise<{ ok: boolean; error?: string; normalized?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "La URL no es válida" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Solo se permiten URLs http:// o https://" };
  }

  const host = parsed.hostname.toLowerCase();

  if (/^localhost$/i.test(host) || /^0\.0\.0\.0$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones internas" };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IP directas" };
  }
  if (/^\[/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IPv6 directas" };
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, error: "No se pudo resolver el dominio" };
  }

  if (addresses.length === 0) {
    return { ok: false, error: "El dominio no resuelve a ninguna dirección" };
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      log.warn({ host, address }, "SSRF block: private IPv4");
      return { ok: false, error: "La URL apunta a una red interna" };
    }
    if (family === 6 && isPrivateIPv6(address)) {
      log.warn({ host, address }, "SSRF block: private IPv6");
      return { ok: false, error: "La URL apunta a una red interna" };
    }
  }

  return { ok: true, normalized: parsed.href };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/ssrf.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Update `competitor/analyze/route.ts` to use the shared module**

In `src/app/api/competitor/analyze/route.ts`, delete the local `isPrivateIPv4`, `isPrivateIPv6`, and `validateUrlSSRF` function definitions (the whole "SSRF Protection — DNS-based validation" block), and add this import at the top instead:

```ts
import { validateUrlSSRF } from "@/lib/security/ssrf";
```

Remove the now-unused `import { promises as dns, LookupAddress } from "dns";` line from that file (the DNS import moved into `ssrf.ts`). Everything else in the file (the `validateUrlSSRF(rawUrl)` call site, the CSRF `checkOrigin` function, the route handler) stays unchanged.

- [ ] **Step 6: Run full typecheck and existing tests to confirm no regression**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 TypeScript errors, all existing test suites still pass, plus the new 6 SSRF tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/security/ssrf.ts src/app/api/competitor/analyze/route.ts __tests__/unit/ssrf.test.ts
git commit -m "refactor: extract SSRF validation into shared src/lib/security/ssrf.ts"
```

---

### Task 2: Add the enriched-input rate limiter

**Files:**
- Modify: `src/lib/rate-limit.ts` (append a new export at the end of the file)

**Interfaces:**
- Produces: `ratelimitEnrichedInput: Ratelimit` — a fixed 10-per-24h-per-user limiter, same shape as `ratelimitCompetitor`. Consumed by Task 11 (upload route, per CSV row) and Task 13 (PDF enrich endpoint).

- [ ] **Step 1: Add the new limiter**

Append to `src/lib/rate-limit.ts` (after the existing `ratelimitLeads` export):

```ts

// Input Enriquecido (URL en CSV o PDF por listing): 10 solicitudes/día por usuario
export const ratelimitEnrichedInput = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/enriched-input",
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors (no test needed — this is a thin config object identical in shape to 6 existing exports in the same file; behavior is covered indirectly by Task 11/13's route tests, which mock `@/lib/rate-limit`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: add ratelimitEnrichedInput rate limiter"
```

---

### Task 3: Add the `enrichedSources` table and its migration

**Files:**
- Modify: `src/db/schema.ts` (add new table export after `competitorAnalyses`)
- Create: `drizzle/0003_add_enriched_sources.sql`
- Modify: `drizzle/README.md` (add migration log row)

**Interfaces:**
- Produces: `schema.enrichedSources` — Drizzle table with columns `id, userId, listingId, sourceType, sourceRef, status, extractedText, errorMessage, cacheExpiresAt, createdAt`. Consumed by Task 11, 12, 13, 14.

- [ ] **Step 1: Add the table to schema.ts**

In `src/db/schema.ts`, insert this after the `competitorAnalyses` export (before `export const leads = ...`):

```ts
// Fuentes de contenido adicional (URL o PDF) usadas como contexto extra para
// la generación — ver docs/superpowers/specs/2026-07-25-input-enriquecido-design.md.
// Solo se guarda el texto ya extraído, nunca el binario del PDF ni el HTML crudo.
export const enrichedSources = sqliteTable("enriched_sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  listingId: text("listing_id"),
  sourceType: text("source_type").notNull(), // "url" | "pdf"
  sourceRef: text("source_ref").notNull(), // URL normalizada, o nombre de archivo original del PDF
  status: text("status").notNull().default("PENDING"), // PENDING | COMPLETED | FAILED
  extractedText: text("extracted_text"),
  errorMessage: text("error_message"),
  cacheExpiresAt: integer("cache_expires_at"),
  createdAt: integer("created_at").notNull().default(0),
}, (table) => ({
  userIdx: index("idx_enriched_sources_user_id").on(table.userId),
  listingIdx: index("idx_enriched_sources_listing_id").on(table.listingId),
}));
```

- [ ] **Step 2: Create the migration file**

```sql
-- drizzle/0003_add_enriched_sources.sql
-- Migration: create enriched_sources table
-- Applied manually via Turso CLI (see README.md in this folder).
-- Safe to run twice: CREATE TABLE/INDEX IF NOT EXISTS is valid SQLite syntax
-- (unlike ALTER TABLE ADD COLUMN, which is NOT — see 0002's note).

CREATE TABLE IF NOT EXISTS enriched_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  listing_id TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  extracted_text TEXT,
  error_message TEXT,
  cache_expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_enriched_sources_user_id ON enriched_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_enriched_sources_listing_id ON enriched_sources(listing_id);
```

- [ ] **Step 3: Update the migration log**

In `drizzle/README.md`, add a row to the "Migration log" table (after the `0002_add_generation_mode.sql` row):

```
| `0003_add_enriched_sources.sql` | Crea la tabla `enriched_sources` (Input Enriquecido) | Pending — **must run before deploying the code that reads/writes it** |
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0003_add_enriched_sources.sql drizzle/README.md
git commit -m "feat: add enrichedSources table + migration for Input Enriquecido"
```

---

### Task 4: HTML text extraction helper

**Files:**
- Create: `src/lib/scraping/extract-text.ts`
- Test: `__tests__/unit/extract-text-html.test.ts`

**Interfaces:**
- Produces: `extractTextFromHtml(html: string): { title: string; text: string }` and `fetchAndExtractText(url: string): Promise<{ title: string; text: string }>`. Consumed by Task 12 (process-products.ts, URL flow).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/extract-text-html.test.ts
import { extractTextFromHtml } from "@/lib/scraping/extract-text";

describe("extractTextFromHtml", () => {
  it("extracts title and body paragraphs, stripping scripts/nav", () => {
    const html = `
      <html><head><title>Fallback Title</title></head>
      <body>
        <nav>Menú de navegación</nav>
        <script>console.log("no debe aparecer")</script>
        <h1>Persiana Veneciana Aluminio</h1>
        <p>Fabricada en aluminio anodizado de 25mm de espesor.</p>
        <footer>Pie de página</footer>
      </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("Persiana Veneciana Aluminio");
    expect(result.text).toContain("Fabricada en aluminio anodizado");
    expect(result.text).not.toContain("Menú de navegación");
    expect(result.text).not.toContain("no debe aparecer");
    expect(result.text).not.toContain("Pie de página");
  });

  it("falls back to <title> when there is no h1 or og:title", () => {
    const html = `<html><head><title>Solo Title</title></head><body><p>Texto breve pero suficiente para el test</p></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("Solo Title");
  });

  it("ignores very short paragraph fragments", () => {
    const html = `<html><body><p>Hi</p><p>Este párrafo sí tiene contenido suficiente</p></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.text).not.toContain("Hi");
    expect(result.text).toContain("Este párrafo sí tiene contenido suficiente");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/extract-text-html.test.ts`
Expected: FAIL with "Cannot find module '@/lib/scraping/extract-text'"

- [ ] **Step 3: Implement**

```ts
// src/lib/scraping/extract-text.ts
import * as cheerio from "cheerio";

export interface ExtractedPage {
  title: string;
  text: string;
}

const MAX_TEXT_CHARS = 10000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB

export function extractTextFromHtml(html: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, iframe, noscript, svg, [hidden]").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "";

  const parts: string[] = [];
  $("h1, h2, h3, p, li").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text.length > 10) parts.push(text);
  });

  return { title: title.slice(0, 200), text: parts.join("\n").slice(0, MAX_TEXT_CHARS) };
}

export async function fetchAndExtractText(url: string): Promise<ExtractedPage> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ListWiseBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  let received = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_HTML_BYTES) throw new Error("Response too large");
    chunks.push(value);
  }

  const html = Buffer.concat(chunks).toString("utf-8");
  return extractTextFromHtml(html);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/extract-text-html.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraping/extract-text.ts __tests__/unit/extract-text-html.test.ts
git commit -m "feat: add HTML text extraction helper for Input Enriquecido"
```

---

### Task 5: PDF text extraction helper

**Files:**
- Modify: `package.json` (add `pdf-parse` dependency)
- Create: `src/lib/pdf/extract-text.ts`
- Test: `__tests__/unit/extract-text-pdf.test.ts`

**Interfaces:**
- Produces: `extractTextFromPdf(buffer: Buffer): Promise<{ hasText: boolean; text: string; numPages: number }>`. Consumed by Task 13 (PDF enrich preview endpoint).

- [ ] **Step 1: Add the dependency**

```bash
npm install pdf-parse@1.1.4
```

This pins the exact last-stable 1.x release (npm's `minor` dist-tag) rather than the 2.x rewrite, matching this project's practice of exact-pinning new/less-proven dependencies.

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/unit/extract-text-pdf.test.ts
import { extractTextFromPdf } from "@/lib/pdf/extract-text";

jest.mock("pdf-parse", () => jest.fn());
import pdfParse from "pdf-parse";
const mockPdfParse = pdfParse as unknown as jest.Mock;

describe("extractTextFromPdf", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports hasText=true when there is enough text per page", async () => {
    mockPdfParse.mockResolvedValue({
      text: "A".repeat(200),
      numpages: 2,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.hasText).toBe(true);
    expect(result.numPages).toBe(2);
  });

  it("reports hasText=false for a scanned PDF (below 50 chars/page)", async () => {
    mockPdfParse.mockResolvedValue({
      text: "",
      numpages: 3,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.hasText).toBe(false);
  });

  it("truncates extracted text to 10000 chars", async () => {
    mockPdfParse.mockResolvedValue({
      text: "B".repeat(20000),
      numpages: 1,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.text.length).toBe(10000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/unit/extract-text-pdf.test.ts`
Expected: FAIL with "Cannot find module '@/lib/pdf/extract-text'"

- [ ] **Step 4: Implement**

```ts
// src/lib/pdf/extract-text.ts
import pdfParse from "pdf-parse";

export interface PdfExtractionResult {
  hasText: boolean;
  text: string;
  numPages: number;
}

const MIN_CHARS_PER_PAGE = 50;
const MAX_TEXT_CHARS = 10000;

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  const data = await pdfParse(buffer);
  const numPages = data.numpages || 1;
  const text = (data.text || "").trim();
  const hasText = text.length >= MIN_CHARS_PER_PAGE * numPages;
  return { hasText, text: text.slice(0, MAX_TEXT_CHARS), numPages };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/unit/extract-text-pdf.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/pdf/extract-text.ts __tests__/unit/extract-text-pdf.test.ts
git commit -m "feat: add PDF text extraction helper (pdf-parse@1.1.4)"
```

---

### Task 6: Language mismatch detection heuristic

**Files:**
- Create: `src/lib/text/detect-language.ts`
- Test: `__tests__/unit/detect-language.test.ts`

**Interfaces:**
- Produces: `detectLanguageMismatch(text: string, expected: "es" | "en"): boolean`. Consumed by Task 8 (structured extraction) and Task 12 (process-products.ts).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/detect-language.test.ts
import { detectLanguageMismatch } from "@/lib/text/detect-language";

describe("detectLanguageMismatch", () => {
  it("returns false when the text matches the expected language", () => {
    const text = "El producto está fabricado con materiales de la más alta calidad para el hogar y la cocina.";
    expect(detectLanguageMismatch(text, "es")).toBe(false);
  });

  it("returns true when the text is dominantly in a different language", () => {
    const text = "The product is manufactured with the highest quality materials for the home and kitchen area.";
    expect(detectLanguageMismatch(text, "es")).toBe(true);
  });

  it("returns false (known limitation) when there is not enough signal — short text", () => {
    expect(detectLanguageMismatch("Aluminio 25mm", "es")).toBe(false);
  });

  it("returns false (known limitation) when there is not enough signal — empty text", () => {
    expect(detectLanguageMismatch("", "es")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/detect-language.test.ts`
Expected: FAIL with "Cannot find module '@/lib/text/detect-language'"

- [ ] **Step 3: Implement**

```ts
// src/lib/text/detect-language.ts
// Simple marker-word heuristic, not a real language-detection model — cheap
// and good enough for the common case, but known to misfire on short or
// mixed-language text (e.g. Spanish spec sheets with English brand/technical
// terms). Documented limitation, not a blocker for v1 — see design spec.
const SPANISH_MARKERS = /\b(el|la|los|las|de|del|para|con|una|uno|es|son|está|están|que|más|sin|fabricado|producto)\b/gi;
const ENGLISH_MARKERS = /\b(the|and|for|with|is|are|this|that|from|without|more|manufactured|product)\b/gi;
const MIN_SIGNAL = 5;

export function detectLanguageMismatch(text: string, expected: "es" | "en"): boolean {
  const sample = text.slice(0, 2000);
  const esMatches = (sample.match(SPANISH_MARKERS) ?? []).length;
  const enMatches = (sample.match(ENGLISH_MARKERS) ?? []).length;
  const total = esMatches + enMatches;
  if (total < MIN_SIGNAL) return false;
  const dominant = esMatches >= enMatches ? "es" : "en";
  return dominant !== expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/detect-language.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/text/detect-language.ts __tests__/unit/detect-language.test.ts
git commit -m "feat: add language-mismatch heuristic for Input Enriquecido"
```

---

### Task 7: Attribute precedence merge helper

**Files:**
- Create: `src/lib/listings/merge-attributes.ts`
- Test: `__tests__/unit/merge-attributes.test.ts`

**Interfaces:**
- Produces: `mergeAttributesWithPrecedence(manual: Record<string,string> | null, extracted: Record<string,string> | null): { merged: Record<string,string>; conflicts: { key: string; manualValue: string; extractedValue: string }[] }`. Consumed by Task 12, 13, 14.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/merge-attributes.test.ts
import { mergeAttributesWithPrecedence } from "@/lib/listings/merge-attributes";

describe("mergeAttributesWithPrecedence", () => {
  it("fills gaps from extracted specs when manual attributes lack them", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      { color: "blanco" },
      { material: "aluminio", medidas: "120x80cm" }
    );
    expect(merged).toEqual({ color: "blanco", material: "aluminio", medidas: "120x80cm" });
    expect(conflicts).toEqual([]);
  });

  it("manual value always wins on key conflict, and records the conflict", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      { material: "PVC" },
      { material: "aluminio" }
    );
    expect(merged.material).toBe("PVC");
    expect(conflicts).toEqual([{ key: "material", manualValue: "PVC", extractedValue: "aluminio" }]);
  });

  it("handles null manual attributes", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(null, { material: "aluminio" });
    expect(merged).toEqual({ material: "aluminio" });
    expect(conflicts).toEqual([]);
  });

  it("handles null extracted specs", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence({ color: "blanco" }, null);
    expect(merged).toEqual({ color: "blanco" });
    expect(conflicts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/merge-attributes.test.ts`
Expected: FAIL with "Cannot find module '@/lib/listings/merge-attributes'"

- [ ] **Step 3: Implement**

```ts
// src/lib/listings/merge-attributes.ts
export interface AttributeConflict {
  key: string;
  manualValue: string;
  extractedValue: string;
}

export interface MergeResult {
  merged: Record<string, string>;
  conflicts: AttributeConflict[];
}

// Manual (CSV) attributes are treated as ground truth throughout this
// codebase (see the "Atributos confirmados" rule in prompts.ts) — extracted
// specs only fill gaps the user didn't already provide, never override them.
export function mergeAttributesWithPrecedence(
  manual: Record<string, string> | null,
  extracted: Record<string, string> | null
): MergeResult {
  const merged: Record<string, string> = { ...(extracted ?? {}) };
  const conflicts: AttributeConflict[] = [];

  if (manual) {
    for (const [key, value] of Object.entries(manual)) {
      if (extracted && key in extracted && extracted[key] !== value) {
        conflicts.push({ key, manualValue: value, extractedValue: extracted[key] });
      }
      merged[key] = value;
    }
  }

  return { merged, conflicts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/merge-attributes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/listings/merge-attributes.ts __tests__/unit/merge-attributes.test.ts
git commit -m "feat: add manual-wins attribute precedence merge helper"
```

---

### Task 8: Structured specs extraction (cheap LLM call)

**Files:**
- Create: `src/lib/ai/extract-specs.ts`
- Test: `__tests__/unit/extract-specs.test.ts`

**Interfaces:**
- Consumes: `getAIResponse` from `@/lib/ai/providers` (signature: `getAIResponse(messages: {role:string;content:string}[], providerName?: AIProvider, options?: {temperature?, max_tokens?, response_format?}): Promise<...>`).
- Produces: `extractSpecsFromText(rawText: string, productName: string, translateToSpanish: boolean): Promise<Record<string,string>>`. Consumed by Task 12, 13.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/extract-specs.test.ts
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { getAIResponse } from "@/lib/ai/providers";

jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
}));
const mockGetAIResponse = getAIResponse as jest.Mock;

describe("extractSpecsFromText", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid JSON response into a flat string record", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: '{"material": "aluminio", "medidas": "120x80cm"}' } }],
    });
    const result = await extractSpecsFromText("texto largo del pdf", "Persiana", false);
    expect(result).toEqual({ material: "aluminio", medidas: "120x80cm" });
  });

  it("drops non-string values from the parsed JSON", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: '{"material": "aluminio", "peso": 5, "vacio": ""}' } }],
    });
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({ material: "aluminio" });
  });

  it("returns {} (non-blocking) when the AI call throws", async () => {
    mockGetAIResponse.mockRejectedValue(new Error("groq down"));
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({});
  });

  it("returns {} when the response has no parseable JSON", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "no json here" } }] });
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({});
  });

  it("includes a translation instruction in the prompt when translateToSpanish is true", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractSpecsFromText("some english text", "Producto", true);
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent).toContain("traduce");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/extract-specs.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/extract-specs'"

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/extract-specs.ts
import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

const MAX_INPUT_CHARS = 8000;

// Deliberately a cheap, separate call (Groq's small model) that reduces raw
// source text to confirmed key-value specs — the raw text itself never
// reaches the main generation prompt (see design spec, decision #2).
export async function extractSpecsFromText(
  rawText: string,
  productName: string,
  translateToSpanish: boolean
): Promise<Record<string, string>> {
  const truncated = rawText.slice(0, MAX_INPUT_CHARS);
  const translateInstruction = translateToSpanish
    ? " El texto puede estar en otro idioma — traduce los valores extraídos al español."
    : "";
  const prompt =
    `Extrae únicamente especificaciones técnicas CONFIRMADAS de este texto sobre "${productName}".` +
    `${translateInstruction} Devuelve SOLO un JSON plano de clave-valor ` +
    `(ej: {"material": "aluminio", "medidas": "120x80cm"}). No inventes datos que no estén en el texto. ` +
    `Si no hay especificaciones claras, devuelve {}.\n\nTEXTO:\n${truncated}`;

  try {
    const response = await getAIResponse(
      [{ role: "user", content: prompt }],
      "groq",
      { temperature: 0.1, response_format: { type: "json_object" } }
    );
    const completion = response as { choices: { message: { content: string | null } }[] };
    const text = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
    }
    return result;
  } catch (error) {
    log.warn({ err: error }, "extractSpecsFromText failed — returning empty specs");
    return {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/extract-specs.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/extract-specs.ts __tests__/unit/extract-specs.test.ts
git commit -m "feat: add structured specs extraction via cheap LLM call"
```

---

### Task 9: CSV row validation for the optional `sourceUrl` column

**Files:**
- Modify: `src/lib/csv/validate-rows.ts`
- Test: `__tests__/unit/validate-csv.test.ts` (add cases to the existing file)

**Interfaces:**
- Modifies: `validateRows(records: Record<string,string>[]): ValidationResult` — unchanged signature, adds a new warning-level check.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/validate-csv.test.ts` (find the existing `describe("validateRows", ...)` block and add these `it`s inside it):

```ts
  it("warns (does not error) on a malformed sourceUrl", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "not-a-url" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("sourceUrl"))).toBe(true);
  });

  it("warns on a non-http(s) sourceUrl scheme", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "ftp://example.com/file" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("sourceUrl"))).toBe(true);
  });

  it("accepts a valid https sourceUrl without warnings", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "https://proveedor.com/ficha" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/validate-csv.test.ts`
Expected: FAIL — the two "warns" cases fail because no `sourceUrl` check exists yet (warnings array is empty when it shouldn't be).

- [ ] **Step 3: Implement**

In `src/lib/csv/validate-rows.ts`, inside the `for` loop in `validateRows` (after the existing `attributes` JSON-validity check, before the closing brace of the loop), add:

```ts
    if (record.sourceUrl?.trim()) {
      try {
        const parsedUrl = new URL(record.sourceUrl.trim());
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          warnings.push(
            `Fila ${row}: sourceUrl debe empezar por http:// o https:// — se ignorará`
          );
        }
      } catch {
        warnings.push(`Fila ${row}: sourceUrl no es una URL válida — se ignorará`);
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/validate-csv.test.ts`
Expected: PASS (all existing tests + 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv/validate-rows.ts __tests__/unit/validate-csv.test.ts
git commit -m "feat: validate optional sourceUrl CSV column (warning-level, non-blocking)"
```

---

### Task 10: CSV template and dashboard hint text

**Files:**
- Modify: `src/app/api/template/csv/route.ts`
- Modify: `src/app/dashboard/page.tsx:1018-1022` (the "Columna requerida" hint block)

**Interfaces:** none (pure content change, no new exports).

- [ ] **Step 1: Update the template generator**

Replace the full body of `src/app/api/template/csv/route.ts` with:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const headers = "productName,category,attributes,sourceUrl\n";
  const example = `Camiseta de algodón orgánico,Ropa,"{""talla"":""M-L"",""color"":""Blanco"",""material"":""100% Algodón orgánico""}",\n`;
  const example2 = `Persiana veneciana aluminio,Hogar,"{""material"":""Aluminio""}",https://proveedor-ejemplo.com/ficha-persiana\n`;

  const csvContent = headers + example + example2;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="plantilla_listwise.csv"',
    },
  });
}
```

- [ ] **Step 2: Update the dashboard hint text**

In `src/app/dashboard/page.tsx`, find this block (around line 1018):

```tsx
                <p className="text-xs text-gray-400">
                  Columna requerida:{" "}
                  <code className="bg-gray-100 px-1 rounded">productName</code>. Opciones:{" "}
                  <code className="bg-gray-100 px-1 rounded">category</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">attributes</code>
                </p>
```

Replace it with:

```tsx
                <p className="text-xs text-gray-400">
                  Columna requerida:{" "}
                  <code className="bg-gray-100 px-1 rounded">productName</code>. Opciones:{" "}
                  <code className="bg-gray-100 px-1 rounded">category</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">attributes</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">sourceUrl</code>
                </p>
```

- [ ] **Step 3: Run typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/template/csv/route.ts src/app/dashboard/page.tsx
git commit -m "feat: add optional sourceUrl column to CSV template and hint text"
```

---

### Task 11: Upload route — create `enrichedSources` rows from CSV `sourceUrl`

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Test: `__tests__/unit/upload-enriched-sources.test.ts` (new, focused only on the new logic — the existing upload route has no dedicated unit test file today, so this introduces one scoped to the CSV→enrichedSources wiring)

**Interfaces:**
- Consumes: `validateUrlSSRF` (Task 1), `ratelimitEnrichedInput` (Task 2), `schema.enrichedSources` (Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/upload-enriched-sources.test.ts
// Focused unit test for the CSV-row -> enrichedSources row-building logic,
// extracted as a pure function so it's testable without mocking the whole
// Next.js route (db insert, credits, Trigger.dev fetch, etc.).
import { buildEnrichedSourceRows } from "@/lib/csv/build-enriched-sources";
import { validateUrlSSRF } from "@/lib/security/ssrf";

jest.mock("@/lib/security/ssrf", () => ({ validateUrlSSRF: jest.fn() }));
const mockValidate = validateUrlSSRF as jest.Mock;

describe("buildEnrichedSourceRows", () => {
  beforeEach(() => jest.clearAllMocks());

  it("skips rows without a sourceUrl", async () => {
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toEqual([]);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("skips a row when the rate limit check fails for that row", async () => {
    mockValidate.mockResolvedValue({ ok: true, normalized: "https://example.com/a" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "https://example.com/a" }],
      ["listing-1"],
      "user-1",
      async () => false
    );
    expect(rows).toEqual([]);
  });

  it("skips a row when SSRF validation fails", async () => {
    mockValidate.mockResolvedValue({ ok: false, error: "blocked" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "http://169.254.169.254/" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toEqual([]);
  });

  it("creates a PENDING enrichedSources row for a valid sourceUrl", async () => {
    mockValidate.mockResolvedValue({ ok: true, normalized: "https://proveedor.com/ficha" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "https://proveedor.com/ficha" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "user-1",
      listingId: "listing-1",
      sourceType: "url",
      sourceRef: "https://proveedor.com/ficha",
      status: "PENDING",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/upload-enriched-sources.test.ts`
Expected: FAIL with "Cannot find module '@/lib/csv/build-enriched-sources'"

- [ ] **Step 3: Implement the extracted pure function**

```ts
// src/lib/csv/build-enriched-sources.ts
import { v4 as uuidv4 } from "uuid";
import { validateUrlSSRF } from "@/lib/security/ssrf";

export interface EnrichedSourceInsertRow {
  id: string;
  userId: string;
  listingId: string;
  sourceType: "url";
  sourceRef: string;
  status: "PENDING";
  extractedText: null;
  errorMessage: null;
  cacheExpiresAt: number;
  createdAt: number;
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Extracted as a pure function (no db import) so it's unit-testable without
// mocking Drizzle — the upload route calls this, then inserts the result.
export async function buildEnrichedSourceRows(
  records: { sourceUrl?: string }[],
  listingIds: string[],
  userId: string,
  checkRateLimit: () => Promise<boolean>
): Promise<EnrichedSourceInsertRow[]> {
  const rows: EnrichedSourceInsertRow[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < records.length; i++) {
    const rawUrl = records[i].sourceUrl?.trim();
    if (!rawUrl) continue;

    const allowed = await checkRateLimit();
    if (!allowed) continue; // fallback no bloqueante: fila se genera sin fuente

    const check = await validateUrlSSRF(rawUrl);
    if (!check.ok) continue;

    rows.push({
      id: uuidv4(),
      userId,
      listingId: listingIds[i],
      sourceType: "url",
      sourceRef: check.normalized!,
      status: "PENDING",
      extractedText: null,
      errorMessage: null,
      cacheExpiresAt: now + THIRTY_DAYS_SECONDS,
      createdAt: now,
    });
  }

  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/upload-enriched-sources.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire it into the upload route**

In `src/app/api/upload/route.ts`, add these imports at the top (alongside the existing ones):

```ts
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { buildEnrichedSourceRows } from "@/lib/csv/build-enriched-sources";
```

Then, immediately after the existing `await db.insert(schema.listings).values(listings);` line (step "6. Insertar productos en la base de datos"), add:

```ts

    // 6b. Fuentes enriquecidas (columna sourceUrl opcional) — validación SSRF
    // ahora; el fetch + extracción real ocurre en process-products.ts.
    const enrichedRows = await buildEnrichedSourceRows(
      records,
      listings.map((l) => l.id),
      userId,
      async () => (await ratelimitEnrichedInput.limit(userId)).success
    );
    if (enrichedRows.length > 0) {
      await db.insert(schema.enrichedSources).values(enrichedRows);
      log.info({ userId, count: enrichedRows.length }, "Enriched sources queued");
    }
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 errors, 0 lint warnings, all test suites pass (existing + 4 new).

- [ ] **Step 7: Commit**

```bash
git add src/lib/csv/build-enriched-sources.ts src/app/api/upload/route.ts __tests__/unit/upload-enriched-sources.test.ts
git commit -m "feat: queue enrichedSources rows from CSV sourceUrl column on upload"
```

---

### Task 12: `process-products.ts` — fetch, extract, and merge enriched URL sources

**Files:**
- Modify: `src/trigger/jobs/process-products.ts`

**Interfaces:**
- Consumes: `fetchAndExtractText` (Task 4), `detectLanguageMismatch` (Task 6), `extractSpecsFromText` (Task 8), `mergeAttributesWithPrecedence` (Task 7), `schema.enrichedSources` (Task 3).

- [ ] **Step 1: Add imports**

In `src/trigger/jobs/process-products.ts`, add these imports (alongside the existing ones):

```ts
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { detectLanguageMismatch } from "@/lib/text/detect-language";
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { mergeAttributesWithPrecedence } from "@/lib/listings/merge-attributes";
```

- [ ] **Step 2: Insert the enrichment step inside the per-product loop**

In the `for (const product of pendingListings)` loop, immediately before the `const response = await retry.onThrow(...)` block, insert:

```ts
        // Fuente enriquecida (URL desde CSV, ver Input Enriquecido): si hay
        // una fila PENDING para este listing, la procesamos ahora. Fallo aquí
        // nunca bloquea la generación — solo se pierde el contexto extra.
        let mergedAttributes = product.attributes as Record<string, string> | null;
        const [pendingSource] = await db
          .select()
          .from(schema.enrichedSources)
          .where(
            and(
              eq(schema.enrichedSources.listingId, product.id),
              eq(schema.enrichedSources.status, "PENDING")
            )
          )
          .limit(1);

        if (pendingSource) {
          try {
            const page = await fetchAndExtractText(pendingSource.sourceRef);
            const needsTranslation = detectLanguageMismatch(page.text, "es");
            const specs = await extractSpecsFromText(page.text, product.productName, needsTranslation);
            await db
              .update(schema.enrichedSources)
              .set({ status: "COMPLETED", extractedText: page.text })
              .where(eq(schema.enrichedSources.id, pendingSource.id));
            mergedAttributes = mergeAttributesWithPrecedence(mergedAttributes, specs).merged;
          } catch (sourceError) {
            log.warn(
              { userId, listingId: product.id, err: sourceError },
              "Enriched source fetch/extract failed — continuing without it"
            );
            await db
              .update(schema.enrichedSources)
              .set({ status: "FAILED", errorMessage: "No se pudo leer la fuente indicada" })
              .where(eq(schema.enrichedSources.id, pendingSource.id));
          }
        }

```

- [ ] **Step 3: Use the merged attributes in the generation call**

In the same loop, find this line inside the `buildUserPromptWithVoice` call's argument object:

```ts
                    attributes: product.attributes as Record<string, string> | null,
```

Replace it with:

```ts
                    attributes: mergedAttributes,
```

- [ ] **Step 4: Run full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 errors, 0 warnings, all existing test suites still pass (this file has no dedicated unit test today — it's exercised end-to-end in staging per Task 16's manual verification step, consistent with how the rest of this Trigger.dev job is tested in this codebase).

- [ ] **Step 5: Commit**

```bash
git add src/trigger/jobs/process-products.ts
git commit -m "feat: process enriched URL sources during batch generation"
```

---

### Task 13: New endpoint — PDF enrich preview (extract + merge, no charge) + cached-source lookup

**Files:**
- Create: `src/app/api/listings/[id]/enrich/route.ts`
- Test: `__tests__/unit/listings-enrich-route.test.ts`

**Interfaces:**
- Consumes: `ratelimitEnrichedInput` (Task 2), `extractTextFromPdf` (Task 5), `detectLanguageMismatch` (Task 6), `extractSpecsFromText` (Task 8), `mergeAttributesWithPrecedence` (Task 7), `schema.enrichedSources` (Task 3).
- Produces:
  - `POST /api/listings/[id]/enrich` → `{ sourceId, extractedSpecs, conflicts }` on success, or `{ error, scannedPdf?: true }` on failure.
  - `GET /api/listings/[id]/enrich` → `{ found: true, sourceId, extractedSpecs, conflicts }` when a non-expired `COMPLETED` source already exists for this listing (decision #7: reuse without re-uploading), or `{ found: false }` otherwise.
  - Both consumed by Task 15 (UI).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/listings-enrich-route.test.ts
import { POST, GET } from "@/app/api/listings/[id]/enrich/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ratelimitEnrichedInput: { limit: jest.fn() },
}));
jest.mock("@/lib/pdf/extract-text", () => ({ extractTextFromPdf: jest.fn() }));
jest.mock("@/lib/text/detect-language", () => ({ detectLanguageMismatch: jest.fn().mockReturnValue(false) }));
jest.mock("@/lib/ai/extract-specs", () => ({ extractSpecsFromText: jest.fn() }));

const mockListingSelect = jest.fn();
const mockSourceInsert = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockListingSelect }) }) }),
    insert: () => ({ values: mockSourceInsert }),
  },
  schema: { listings: {}, enrichedSources: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractSpecsFromText } from "@/lib/ai/extract-specs";

function makeRequest(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return new Request("http://localhost/api/listings/listing-1/enrich", { method: "POST", body: fd });
}

function makeGetRequest(): Request {
  return new Request("http://localhost/api/listings/listing-1/enrich", { method: "GET" });
}

function makeParams(id = "listing-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/listings/[id]/enrich", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: true });
    mockListingSelect.mockResolvedValue([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }]);
    mockSourceInsert.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 400 for a non-PDF file", async () => {
    const res = await POST(makeRequest(new File(["x"], "f.png", { type: "image/png" })), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 422 with scannedPdf flag when the PDF has no extractable text", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: false, text: "", numPages: 2 });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.scannedPdf).toBe(true);
    expect(body.error).toContain("imagen escaneada");
  });

  it("returns merged specs and conflicts on success", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: true, text: "texto del pdf", numPages: 1 });
    (extractSpecsFromText as jest.Mock).mockResolvedValue({ material: "aluminio", color: "gris" });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.extractedSpecs).toEqual({ material: "aluminio", color: "blanco" });
    expect(body.conflicts).toEqual([{ key: "color", manualValue: "blanco", extractedValue: "gris" }]);
    expect(mockSourceInsert).toHaveBeenCalled();
  });
});

describe("GET /api/listings/[id]/enrich (cached-source lookup)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ userId: "user-1" });
  });

  it("returns found=false when there is no cached source", async () => {
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
      .mockResolvedValueOnce([]);
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("returns found=true with re-merged specs when a non-expired COMPLETED source exists", async () => {
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
      .mockResolvedValueOnce([{ id: "source-1", extractedText: "aluminio 120x80" }]);
    (extractSpecsFromText as jest.Mock).mockResolvedValue({ material: "aluminio" });
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.sourceId).toBe("source-1");
    expect(body.extractedSpecs).toEqual({ material: "aluminio", color: "blanco" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/listings-enrich-route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/listings/[id]/enrich/route'"

- [ ] **Step 3: Implement**

```ts
// src/app/api/listings/[id]/enrich/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { detectLanguageMismatch } from "@/lib/text/detect-language";
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { mergeAttributesWithPrecedence } from "@/lib/listings/merge-attributes";
import { log } from "@/lib/logger";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Decision #7 (reutilización de fuente): the dashboard modal calls this on
// open before showing the upload form, so a listing already enriched within
// the last 30 days can be regenerated without re-uploading the PDF.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const [listing] = await db
      .select({ id: schema.listings.id, productName: schema.listings.productName, attributes: schema.listings.attributes })
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);
    if (!listing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const now = Math.floor(Date.now() / 1000);
    const [cached] = await db
      .select({ id: schema.enrichedSources.id, extractedText: schema.enrichedSources.extractedText })
      .from(schema.enrichedSources)
      .where(
        and(
          eq(schema.enrichedSources.listingId, id),
          eq(schema.enrichedSources.userId, userId),
          eq(schema.enrichedSources.status, "COMPLETED"),
          gt(schema.enrichedSources.cacheExpiresAt, now)
        )
      )
      .limit(1);

    if (!cached || !cached.extractedText) {
      return NextResponse.json({ found: false });
    }

    // Re-run the (cheap) structured extraction against the *current* listing
    // attributes, in case they changed since the source was first extracted.
    const specs = await extractSpecsFromText(cached.extractedText, listing.productName, false);
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      listing.attributes as Record<string, string> | null,
      specs
    );

    return NextResponse.json({ found: true, sourceId: cached.id, extractedSpecs: merged, conflicts });
  } catch (error) {
    log.error({ err: error }, "Listing enrich lookup error");
    return NextResponse.json({ error: "Error al buscar la fuente" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { success } = await ratelimitEnrichedInput.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Límite diario de fuentes enriquecidas alcanzado (10/día). Inténtalo mañana." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const [listing] = await db
      .select({
        id: schema.listings.id,
        productName: schema.listings.productName,
        attributes: schema.listings.attributes,
      })
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);
    if (!listing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 5MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdf = await extractTextFromPdf(buffer);

    if (pdf.numPages > MAX_PAGES) {
      return NextResponse.json({ error: `El PDF tiene demasiadas páginas (máx ${MAX_PAGES})` }, { status: 400 });
    }
    if (!pdf.hasText) {
      return NextResponse.json(
        {
          error: "Este PDF parece ser una imagen escaneada — no pudimos leer texto seleccionable. La generación continuará sin esta fuente.",
          scannedPdf: true,
        },
        { status: 422 }
      );
    }

    const needsTranslation = detectLanguageMismatch(pdf.text, "es");
    const specs = await extractSpecsFromText(pdf.text, listing.productName, needsTranslation);
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      listing.attributes as Record<string, string> | null,
      specs
    );

    const now = Math.floor(Date.now() / 1000);
    const sourceId = uuidv4();
    await db.insert(schema.enrichedSources).values({
      id: sourceId,
      userId,
      listingId: listing.id,
      sourceType: "pdf",
      sourceRef: file.name.slice(0, 200),
      status: "COMPLETED",
      extractedText: pdf.text,
      errorMessage: null,
      cacheExpiresAt: now + THIRTY_DAYS_SECONDS,
      createdAt: now,
    });

    return NextResponse.json({ sourceId, extractedSpecs: merged, conflicts });
  } catch (error) {
    log.error({ err: error }, "Listing enrich error");
    return NextResponse.json({ error: "Error al procesar el PDF" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/listings-enrich-route.test.ts`
Expected: PASS (7 tests — 5 for POST, 2 for GET)

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 errors, 0 warnings, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/listings/\[id\]/enrich/route.ts __tests__/unit/listings-enrich-route.test.ts
git commit -m "feat: add PDF enrich preview endpoint (extract + merge, no charge)"
```

---

### Task 14: New endpoint — PDF enrich confirm (charge + regenerate)

**Files:**
- Create: `src/app/api/listings/[id]/enrich/confirm/route.ts`
- Test: `__tests__/unit/listings-enrich-confirm-route.test.ts`

**Interfaces:**
- Consumes: `useCredits` from `@/lib/credits/use-credits` (signature: `useCredits(userId, amount, description): Promise<{success, remainingCredits, error?}>`), `buildSystemPrompt`/`buildUserPromptWithVoice`/`MODE_CONFIG` from `@/lib/ai/prompts`, `getAIResponse` from `@/lib/ai/providers`.
- Produces: `POST /api/listings/[id]/enrich/confirm` → `{ success: true, remainingCredits }` on success. Consumed by Task 15 (UI).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/listings-enrich-confirm-route.test.ts
import { POST } from "@/app/api/listings/[id]/enrich/confirm/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn() }));
jest.mock("@/lib/ai/providers", () => ({ getAIResponse: jest.fn() }));

const mockListingSelect = jest.fn();
const mockSourceSelect = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockListingSelect }) }),
    })),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  },
  schema: { listings: {}, enrichedSources: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { useCredits } from "@/lib/credits/use-credits";
import { getAIResponse } from "@/lib/ai/providers";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/listings/listing-1/enrich/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "listing-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/listings/[id]/enrich/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", category: "Hogar", attributes: {}, generationMode: "creative" }])
      .mockResolvedValueOnce([{ id: "source-1" }]);
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 9 });
    (getAIResponse as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"title":"Persiana X","bullets":["a","b","c","d"],"description":"desc"}' } }],
    });
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ sourceId: "s", editedSpecs: {}, consent: true }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 when consent is not exactly true", async () => {
    const res = await POST(makeRequest({ sourceId: "s", editedSpecs: {}, consent: false }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 402 when there are not enough credits", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(res.status).toBe(402);
  });

  it("charges credits and regenerates the listing on success", async () => {
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.remainingCredits).toBe(9);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/listings-enrich-confirm-route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/listings/[id]/enrich/confirm/route'"

- [ ] **Step 3: Implement**

```ts
// src/app/api/listings/[id]/enrich/confirm/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { useCredits } from "@/lib/credits/use-credits";
import { buildSystemPrompt, buildUserPromptWithVoice, MODE_CONFIG, type GenerationMode } from "@/lib/ai/prompts";
import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  sourceId: z.string().min(1),
  editedSpecs: z.record(z.string()),
  consent: z.literal(true),
});

const generatedContentSchema = z.object({
  title: z.string().transform((s) => s.slice(0, 100)),
  title_b: z.string().transform((s) => s.slice(0, 100)).optional(),
  bullets: z.array(z.string()).min(1).max(10),
  description: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Debes confirmar el consentimiento y enviar las especificaciones" },
        { status: 400 }
      );
    }
    const { sourceId, editedSpecs } = parsed.data;

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);
    if (!listing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const [source] = await db
      .select({ id: schema.enrichedSources.id })
      .from(schema.enrichedSources)
      .where(
        and(
          eq(schema.enrichedSources.id, sourceId),
          eq(schema.enrichedSources.listingId, id),
          eq(schema.enrichedSources.userId, userId)
        )
      )
      .limit(1);
    if (!source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });

    const mode = (listing.generationMode ?? "creative") as GenerationMode;
    const creditsRequired = MODE_CONFIG[mode]?.creditsPerProduct ?? 1;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(userId, creditsRequired, "Regeneración con fuente enriquecida");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: `No tienes suficientes créditos. Necesitas ${creditsRequired}.` },
        { status: 402 }
      );
    }

    const finalAttributes = {
      ...((listing.attributes as Record<string, string> | null) ?? {}),
      ...editedSpecs,
    };

    const response = await getAIResponse(
      [
        { role: "system", content: buildSystemPrompt(mode) },
        {
          role: "user",
          content: buildUserPromptWithVoice(
            {
              productName: listing.productName,
              category: listing.category,
              attributes: finalAttributes,
              mode,
            },
            null
          ),
        },
      ],
      "groq",
      {
        temperature: MODE_CONFIG[mode].temperature,
        max_tokens: mode === "tecnica" ? 3000 : 1600,
        response_format: { type: "json_object" },
      }
    );

    const completion = response as { choices: { message: { content: string | null } }[] };
    const text = completion.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("La IA no devolvió datos en el formato correcto.");
    const generated = generatedContentSchema.parse(JSON.parse(jsonMatch[0]));

    await db
      .update(schema.listings)
      .set({
        attributes: finalAttributes,
        generatedTitle: generated.title,
        generatedTitleB: generated.title_b ?? null,
        generatedBullets: generated.bullets,
        generatedDescription: generated.description,
        status: "COMPLETED",
      })
      .where(eq(schema.listings.id, id));

    return NextResponse.json({ success: true, remainingCredits: creditResult.remainingCredits });
  } catch (error) {
    log.error({ err: error }, "Listing enrich confirm error");
    return NextResponse.json({ error: "Error al regenerar el producto" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/listings-enrich-confirm-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 errors, 0 warnings, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/listings/\[id\]/enrich/confirm/route.ts __tests__/unit/listings-enrich-confirm-route.test.ts
git commit -m "feat: add PDF enrich confirm endpoint (charges credit, regenerates listing)"
```

---

### Task 15: Dashboard UI — Enrich-with-PDF modal and trigger button

**Files:**
- Create: `src/components/EnrichListingModal.tsx`
- Modify: `src/app/dashboard/page.tsx` (add state + trigger button in the Acciones column)

**Interfaces:**
- Consumes: `POST /api/listings/[id]/enrich` and `POST /api/listings/[id]/enrich/confirm` (Tasks 13, 14).
- Produces: `<EnrichListingModal listingId productName onClose onSuccess />` component, used by dashboard/page.tsx.

- [ ] **Step 1: Create the modal component**

```tsx
// src/components/EnrichListingModal.tsx
"use client";

import { useState, useEffect } from "react";

interface AttributeConflict {
  key: string;
  manualValue: string;
  extractedValue: string;
}

interface PreviewState {
  sourceId: string;
  extractedSpecs: Record<string, string>;
  conflicts: AttributeConflict[];
}

interface Props {
  listingId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EnrichListingModal({ listingId, productName, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [editedSpecs, setEditedSpecs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "checking" | "extracting" | "confirming" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [reusedCachedSource, setReusedCachedSource] = useState(false);

  // Decision #7 (reutilización de fuente): antes de pedir subir un PDF, mira
  // si ya hay una fuente extraída y vigente (< 30 días) para este listing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/enrich`);
        const data = await res.json();
        if (!cancelled && res.ok && data.found) {
          setPreview({ sourceId: data.sourceId, extractedSpecs: data.extractedSpecs, conflicts: data.conflicts });
          setEditedSpecs(data.extractedSpecs);
          setReusedCachedSource(true);
        }
      } finally {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  function startFresh() {
    setPreview(null);
    setReusedCachedSource(false);
    setFile(null);
  }

  async function handleExtract() {
    if (!file || !consent) return;
    setStatus("extracting");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/listings/${listingId}/enrich`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar el PDF.");
        setStatus("error");
        return;
      }
      setPreview({ sourceId: data.sourceId, extractedSpecs: data.extractedSpecs, conflicts: data.conflicts });
      setEditedSpecs(data.extractedSpecs);
      setStatus("idle");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  async function handleConfirm() {
    if (!preview || !consent) return;
    setStatus("confirming");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/enrich/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: preview.sourceId, editedSpecs, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo regenerar el producto.");
        setStatus("error");
        return;
      }
      onSuccess();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">Enriquecer &quot;{productName}&quot; con PDF de proveedor</h3>

        {status === "checking" && <p className="text-sm text-gray-500">Comprobando fuentes guardadas...</p>}

        {status !== "checking" && !preview && (
          <>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              Confirmo que tengo derecho a usar este documento.
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={handleExtract}
                disabled={!file || !consent || status === "extracting"}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {status === "extracting" ? "Leyendo PDF..." : "Extraer especificaciones"}
              </button>
            </div>
          </>
        )}

        {preview && (
          <>
            {reusedCachedSource && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700">Reutilizando una fuente que ya subiste antes (vigente 30 días).</p>
                <button onClick={startFresh} className="text-xs text-blue-700 underline shrink-0 ml-2">
                  Subir otro PDF
                </button>
              </div>
            )}
            <p className="text-sm text-gray-600">
              Especificaciones detectadas — puedes corregirlas antes de regenerar:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(editedSpecs).map(([key, value]) => (
                <div key={key} className="flex gap-2 items-center">
                  <span className="text-xs font-medium text-gray-500 w-28 shrink-0">{key}</span>
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={value}
                    onChange={(e) => setEditedSpecs((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {preview.conflicts.length > 0 && (
              <p className="text-xs text-amber-600">
                {preview.conflicts.length} valor{preview.conflicts.length === 1 ? "" : "es"} de la fuente no se
                usó porque ya tenías un dato manual distinto.
              </p>
            )}
            {!reusedCachedSource && (
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que tengo derecho a usar este documento.
              </label>
            )}
            <p className="text-xs text-gray-400">
              Esto regenerará el producto por el mismo coste en créditos que ya tiene — sin cargo adicional por usar esta fuente.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={status === "confirming" || (!reusedCachedSource && !consent)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {status === "confirming" ? "Regenerando..." : "Confirmar y regenerar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the modal into the dashboard**

In `src/app/dashboard/page.tsx`, add this import at the top (alongside the other component imports):

```tsx
import EnrichListingModal from "@/components/EnrichListingModal";
```

Add this state near the other modal-related state (alongside `selectedListingId`, around line 93):

```tsx
  const [enrichingListing, setEnrichingListing] = useState<{ id: string; productName: string } | null>(null);
```

In the Acciones column (`src/app/dashboard/page.tsx`, inside the `<div className="flex items-center gap-1 flex-wrap">` block that contains the "🤖 Mejorar" button), add a new button right after the "🤖 Mejorar" button's closing `)}`:

```tsx
                              {listing.status === "COMPLETED" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEnrichingListing({ id: listing.id, productName: listing.productName }); }}
                                  className="px-2.5 py-1 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
                                  title="Enriquecer con PDF de proveedor"
                                >
                                  📎 Enriquecer
                                </button>
                              )}
```

Finally, near the end of the component's JSX (alongside other conditionally-rendered top-level modals, right before the component's closing return-fragment tag), add:

```tsx
      {enrichingListing && (
        <EnrichListingModal
          listingId={enrichingListing.id}
          productName={enrichingListing.productName}
          onClose={() => setEnrichingListing(null)}
          onSuccess={() => {
            setEnrichingListing(null);
            fetchListings(pagination.page);
          }}
        />
      )}
```

- [ ] **Step 3: Run full verification**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 errors, 0 warnings, all suites pass.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the dashboard, click "📎 Enriquecer" on a COMPLETED listing, upload a real PDF, confirm the preview shows extracted specs, click "Confirmar y regenerar", verify the listing updates and credits are deducted.

- [ ] **Step 5: Commit**

```bash
git add src/components/EnrichListingModal.tsx src/app/dashboard/page.tsx
git commit -m "feat: add Enriquecer-con-PDF button and modal to dashboard"
```

---

### Task 16: Final verification and staging deployment

**Files:** none (verification + deployment steps only)

- [ ] **Step 1: Full verification suite**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent`
Expected: 0 TypeScript errors, 0 lint warnings, all test suites pass (16 new/modified test files + all pre-existing ones).

- [ ] **Step 2: Production build check**

Run: `npm run build`
Expected: build compiles successfully (pre-existing local-env limitations around missing Clerk/Upstash keys during static generation are expected and unrelated — see this session's prior note on `/_not-found` prerendering).

- [ ] **Step 3: Create the feature branch from staging**

```bash
git checkout staging
git pull origin staging
git checkout -b feature/input-enriquecido
```

All 16 tasks' commits (Tasks 1-15) should already exist by this point if executed sequentially on this branch — if instead they were built on a fresh branch off `main` or elsewhere, cherry-pick/rebase them onto `feature/input-enriquecido` now.

- [ ] **Step 4: Apply the Turso migration BEFORE merging to staging**

```bash
turso db shell listwise-db "CREATE TABLE IF NOT EXISTS enriched_sources (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, listing_id TEXT, source_type TEXT NOT NULL, source_ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', extracted_text TEXT, error_message TEXT, cache_expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT 0);"
turso db shell listwise-db "CREATE INDEX IF NOT EXISTS idx_enriched_sources_user_id ON enriched_sources(user_id);"
turso db shell listwise-db "CREATE INDEX IF NOT EXISTS idx_enriched_sources_listing_id ON enriched_sources(listing_id);"
turso db shell listwise-db "PRAGMA table_info(enriched_sources);"
```

Expected: the final `PRAGMA` call lists all 10 columns (`id, user_id, listing_id, source_type, source_ref, status, extracted_text, error_message, cache_expires_at, created_at`).

- [ ] **Step 5: Merge to staging and push**

```bash
git checkout staging
git merge --ff-only feature/input-enriquecido
git push origin staging
```

- [ ] **Step 6: Redeploy Trigger.dev from the staging checkout**

```bash
git checkout staging
git pull origin staging
npm run trigger:deploy
```

Expected: `Version <date>.N deployed with <N> detected tasks`, no `TaskIndexingImportError`. (`process-products.ts` changed in Task 12, so this redeploy is required — same lesson learned with Modo Ficha Técnica.)

- [ ] **Step 7: Manual verification in staging**

Upload a CSV row with a real `sourceUrl` and confirm the generated listing reflects the source's specs. Then use "📎 Enriquecer" on an existing listing with a real supplier PDF and confirm the same. Check both the quantitative (Health Score) and qualitative (ask Javier) success criteria from the design spec once he's testing.

- [ ] **Step 8: Update memory / notify**

Do not merge to `main`. Report completion and the manual-verification checklist back to the user before inviting Javier.

- [ ] **Step 9: Record the pre-production security gate (decision #17)**

Before any future merge to `main`, a security review specific to the fetch/enrichment endpoints (`src/lib/security/ssrf.ts`, the `sourceUrl` handling in `src/app/api/upload/route.ts`, and both `enrich` endpoints) is required beyond what this plan implements — this is a deliberate gate from the design spec, not an oversight. Flag this explicitly to the user when the merge-to-`main` conversation happens; do not treat "tests pass in staging" as equivalent to that review.
