# Crear Producto desde URL o PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create a brand-new listing directly from a URL or a PDF (analyze → editable preview → confirm & generate), placed below the "Subir CSV" area in the dashboard — no existing listing required, unlike the existing "📎 Enriquecer" (which only enriches an already-generated listing).

**Architecture:** Two new API routes reusing all of Input Enriquecido's existing SSRF/rate-limit/text-extraction infrastructure, plus one new cheap Groq call (`extractProductInfoFromText`) that extracts a full product description (name/category/attributes) from raw text instead of merging into existing attributes. No new database table — the extracted-and-edited preview *is* the listing's initial attributes, so there's no manual-vs-extracted precedence to resolve. Creation reuses the exact same Trigger.dev batch-generation pipeline the CSV upload already uses, via a newly-extracted shared helper.

**Tech Stack:** Next.js API routes, Drizzle/Turso, Trigger.dev (existing `process-batch` task, unmodified), Groq (cheap extraction call), Jest.

## Global Constraints

- Every new/modified file must pass `npx tsc --noEmit` and `npx jest --silent` before each commit. `npm run lint` is unreliable in this nested worktree (pre-existing environmental issue, unrelated to this code) — do not treat its exit code as a gate, but do read its output for genuine ESLint rule violations if any appear.
- No merge to `main` as part of this plan — implement on `feature/input-enriquecido` (already exists as this worktree), fast-forward to `staging` only.
- The **analyze** step (`POST /api/listings/analyze-source`) must NEVER charge credits — it only previews. The **create** step (`POST /api/listings/create-from-source`) charges `MODE_CONFIG[mode].creditsPerProduct` (1 for creative/professional/seo, 2 for tecnica), matching the CSV-per-product cost exactly, and refunds on a post-charge Trigger.dev dispatch failure (mirroring `src/app/api/upload/route.ts`'s existing refund pattern).
- Rate limiting: `ratelimitEnrichedInput` (the same shared 10/day pool already used by the CSV `sourceUrl` flow and the PDF "📎 Enriquecer" flow) applies to the analyze step (it always performs a real fetch/extraction, so — unlike the earlier GET-cache-check fix — there is no free/no-op path here that should skip metering).
- No `enrichedSources` table involvement in this flow — it is exclusively for the "enrich an existing listing" flows (CSV `sourceUrl` and "📎 Enriquecer"). This flow's extracted product info flows directly into a new `listings` row's initial fields.
- The confidence indicator must be shown for every analysis result (not just high-confidence ones), using the same 3-tier scheme (≥0.75 "Alta confianza" green, ≥0.45 "Confianza media" yellow, else "Baja confianza" red) as the old `PhotoUploader.tsx` (`git show 9f6729c8~1:src/components/PhotoUploader.tsx` for reference — deleted in this repo's history, not on disk). When confidence is below 0.45, the UI must show an explicit warning to double-check all fields before creating (a new requirement, not present in the old component).
- The `extractProductInfoFromText` prompt must explicitly instruct the model to identify and extract only the *main* product being described, ignoring surrounding page noise (navigation, related products, reviews, ads) — this matters specifically for scraped competitor URLs, less so for supplier PDFs which are usually clean.

---

### Task 1: Extract shared Trigger.dev dispatch helper

**Files:**
- Create: `src/lib/trigger/send-batch-event.ts`
- Modify: `src/app/api/upload/route.ts` (remove the local `sendTriggerEvent` function, import from the new module instead)

**Interfaces:**
- Produces: `sendTriggerEvent(userId: string, batchId: string, mode: string, provider?: string, userEmail?: string): Promise<unknown>` — used by Task 3 (the new create-from-source route) in addition to the existing upload route.

- [ ] **Step 1: Create the shared module**

```ts
// src/lib/trigger/send-batch-event.ts
import { log } from "@/lib/logger";

export async function sendTriggerEvent(
  userId: string,
  batchId: string,
  mode: string,
  provider = "groq",
  userEmail?: string
) {
  const response = await fetch("https://api.trigger.dev/api/v1/tasks/process-batch/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
    },
    body: JSON.stringify({
      payload: { userId, batchId, mode, provider, userEmail },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ status: response.status, body: errorText }, "Trigger event failed");
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    throw new Error("TRIGGER_FAILED");
  }

  return response.json();
}
```

This is a byte-for-byte move of the existing function out of `upload/route.ts` — no behavior change.

- [ ] **Step 2: Update `upload/route.ts` to import from the new module**

In `src/app/api/upload/route.ts`:
- Remove the entire `async function sendTriggerEvent(...) { ... }` block (currently defined locally in this file, right after the imports, under the `// ─── Trigger ───` comment).
- Add this import instead, alongside the other imports:
```ts
import { sendTriggerEvent } from "@/lib/trigger/send-batch-event";
```
- The call site (`await sendTriggerEvent(userId, batchId, mode, provider, userEmail);`) stays exactly as-is — only the function's location changes.

- [ ] **Step 3: Run typecheck and full test suite**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 TypeScript errors, all existing test suites still pass (this is a pure extraction with no behavior change — no existing test should need modification, since nothing mocks `sendTriggerEvent` by reaching into `upload/route.ts`'s internals, only via `fetch`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/trigger/send-batch-event.ts src/app/api/upload/route.ts
git commit -m "refactor: extract sendTriggerEvent into shared src/lib/trigger/send-batch-event.ts"
```

---

### Task 2: Structured product-info extraction from text

**Files:**
- Create: `src/lib/ai/extract-product-info.ts`
- Test: `__tests__/unit/extract-product-info.test.ts`

**Interfaces:**
- Consumes: `getAIResponse` from `@/lib/ai/providers` (same signature already used by `src/lib/ai/extract-specs.ts`).
- Produces: `extractProductInfoFromText(text: string): Promise<ProductInfo>` where `ProductInfo = { productName: string; category: string; attributes: Record<string, string>; primaryKeyword: string; confidence: number } | null` (returns `null`, not `{}`, on failure — unlike `extractSpecsFromText`, there is no sensible "empty product" fallback, so the caller must treat `null` as "could not identify a product, show a clear error"). Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/extract-product-info.test.ts
import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";
import { getAIResponse } from "@/lib/ai/providers";

jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
}));
const mockGetAIResponse = getAIResponse as jest.Mock;

describe("extractProductInfoFromText", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid JSON response into a ProductInfo object", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Persiana Veneciana Aluminio 25mm",
            category: "hogar",
            attributes: { material: "aluminio", medidas: "120x180cm" },
            primaryKeyword: "persiana veneciana aluminio",
            confidence: 0.85,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto largo scrapeado de la página");
    expect(result).toEqual({
      productName: "Persiana Veneciana Aluminio 25mm",
      category: "hogar",
      attributes: { material: "aluminio", medidas: "120x180cm" },
      primaryKeyword: "persiana veneciana aluminio",
      confidence: 0.85,
    });
  });

  it("returns null (not throws, not {}) when the AI call rejects", async () => {
    mockGetAIResponse.mockRejectedValue(new Error("groq down"));
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("returns null when the response has no parseable JSON", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "no json here" } }] });
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("returns null when required fields are missing from the parsed JSON", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ productName: "" , category: "hogar" }) } }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("clamps confidence to the [0,1] range if the model returns an out-of-range value", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Producto X",
            category: "hogar",
            attributes: {},
            primaryKeyword: "producto x",
            confidence: 1.4,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(result?.confidence).toBe(1);
  });

  it("includes anti-noise instruction in the prompt about identifying the main product", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto de una página con productos relacionados");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent.toLowerCase()).toContain("producto principal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/extract-product-info.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/extract-product-info'"

- [ ] **Step 3: Implement**

```ts
// src/lib/ai/extract-product-info.ts
import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

export interface ProductInfo {
  productName: string;
  category: string;
  attributes: Record<string, string>;
  primaryKeyword: string;
  confidence: number;
}

const MAX_INPUT_CHARS = 8000;

// Text-based counterpart to the old vision-based product analysis (the
// deleted PhotoUploader's VISION_PROMPT) — same output shape, but reads
// scraped/extracted text instead of an image. Unlike extractSpecsFromText
// (which merges into an EXISTING product's attributes), this extracts a
// full new product description from scratch, so there's no sensible
// "empty" fallback on failure — returns null, and the caller must show a
// clear "could not identify a product" error rather than silently
// proceeding with nothing.
export async function extractProductInfoFromText(text: string): Promise<ProductInfo | null> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const prompt =
    `Eres un experto en ecommerce. A partir de este texto extraído de una página web o un PDF de proveedor, ` +
    `identifica el producto principal descrito (ignora menús de navegación, productos relacionados, reseñas o publicidad — ` +
    `quédate solo con el producto principal de esta fuente) y devuelve SOLO un JSON válido con esta estructura exacta: ` +
    `{"productName": string (nombre descriptivo del producto en español, máx 100 chars), ` +
    `"category": string (una de: ropa, electrónica, hogar, deportes, alimentación, belleza, juguetes, mascotas, otro), ` +
    `"attributes": {clave: valor} (máximo 6 atributos clave como material, color, dimensiones, uso, etc., solo datos confirmados en el texto), ` +
    `"primaryKeyword": string (keyword principal para SEO, 2-4 palabras en español), ` +
    `"confidence": number (0-1, tu nivel de confianza en que identificaste correctamente el producto principal)}` +
    `\n\nTEXTO:\n${truncated}`;

  try {
    const response = await getAIResponse(
      [{ role: "user", content: prompt }],
      "groq",
      { temperature: 0.2, response_format: { type: "json_object" } }
    );
    const completion = response as { choices: { message: { content: string | null } }[] };
    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ProductInfo>;
    if (!parsed.productName || !parsed.category) return null;

    const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const confidence = Math.max(0, Math.min(1, rawConfidence));

    const attributes: Record<string, string> = {};
    if (parsed.attributes && typeof parsed.attributes === "object") {
      for (const [key, value] of Object.entries(parsed.attributes)) {
        if (typeof value === "string" && value.trim()) attributes[key] = value.trim();
      }
    }

    return {
      productName: parsed.productName.slice(0, 100),
      category: parsed.category,
      attributes,
      primaryKeyword: parsed.primaryKeyword ?? "",
      confidence,
    };
  } catch (error) {
    log.warn({ err: error }, "extractProductInfoFromText failed");
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/extract-product-info.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 errors, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/extract-product-info.ts __tests__/unit/extract-product-info.test.ts
git commit -m "feat: add text-based product-info extraction for create-from-source flow"
```

---

### Task 3: Analyze endpoint — `POST /api/listings/analyze-source`

**Files:**
- Create: `src/app/api/listings/analyze-source/route.ts`
- Test: `__tests__/unit/listings-analyze-source-route.test.ts`

**Interfaces:**
- Consumes: `validateUrlSSRF` (`@/lib/security/ssrf`), `ratelimitEnrichedInput` (`@/lib/rate-limit`), `fetchAndExtractText` (`@/lib/scraping/extract-text`), `extractTextFromPdf` (`@/lib/pdf/extract-text`), `extractProductInfoFromText` (Task 2).
- Produces: `POST /api/listings/analyze-source` — accepts `FormData` with either a `url` field (string) or a `file` field (PDF `File`), exactly one of the two. Returns `{ productInfo: ProductInfo }` on success, or `{ error, scannedPdf?: true }` on failure. No credit charge, no `listings`/`enrichedSources` row created. Consumed by Task 5 (UI).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/listings-analyze-source-route.test.ts
import { POST } from "@/app/api/listings/analyze-source/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ ratelimitEnrichedInput: { limit: jest.fn() } }));
jest.mock("@/lib/security/ssrf", () => ({ validateUrlSSRF: jest.fn() }));
jest.mock("@/lib/scraping/extract-text", () => ({ fetchAndExtractText: jest.fn() }));
jest.mock("@/lib/pdf/extract-text", () => ({ extractTextFromPdf: jest.fn() }));
jest.mock("@/lib/ai/extract-product-info", () => ({ extractProductInfoFromText: jest.fn() }));

import { auth } from "@clerk/nextjs/server";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { validateUrlSSRF } from "@/lib/security/ssrf";
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";

function makeUrlRequest(url: string): Request {
  const fd = new FormData();
  fd.append("url", url);
  return new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: fd });
}

function makePdfRequest(file: File): Request {
  const fd = new FormData();
  fd.append("file", file);
  return new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: fd });
}

describe("POST /api/listings/analyze-source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: true });
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    expect(res.status).toBe(429);
  });

  it("returns 400 when neither url nor file is provided", async () => {
    const res = await POST(new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });

  it("analyzes a URL: validates SSRF, fetches, extracts product info", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: true, normalized: "https://example.com/producto" });
    (fetchAndExtractText as jest.Mock).mockResolvedValue({ title: "Producto", text: "texto extraído de la página" });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue({
      productName: "Persiana X", category: "hogar", attributes: { material: "aluminio" }, primaryKeyword: "persiana x", confidence: 0.8,
    });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.productInfo.productName).toBe("Persiana X");
    expect(validateUrlSSRF).toHaveBeenCalledWith("https://example.com/producto");
  });

  it("returns an error when the URL fails SSRF validation, without calling fetchAndExtractText", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: false, error: "La URL apunta a una red interna" });
    const res = await POST(makeUrlRequest("http://169.254.169.254/"));
    expect(res.status).toBe(400);
    expect(fetchAndExtractText).not.toHaveBeenCalled();
  });

  it("analyzes a PDF: extracts text, extracts product info", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: true, text: "texto del pdf", numPages: 2 });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue({
      productName: "Mosquitera Y", category: "hogar", attributes: {}, primaryKeyword: "mosquitera y", confidence: 0.6,
    });
    const file = new File(["contenido"], "ficha.pdf", { type: "application/pdf" });
    const res = await POST(makePdfRequest(file));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.productInfo.productName).toBe("Mosquitera Y");
  });

  it("rejects a non-PDF file with 400", async () => {
    const file = new File(["x"], "imagen.png", { type: "image/png" });
    const res = await POST(makePdfRequest(file));
    expect(res.status).toBe(400);
  });

  it("returns 422 with scannedPdf when the PDF has no extractable text, without calling extractProductInfoFromText", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: false, text: "", numPages: 3 });
    const file = new File(["contenido"], "escaneado.pdf", { type: "application/pdf" });
    const res = await POST(makePdfRequest(file));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.scannedPdf).toBe(true);
    expect(extractProductInfoFromText).not.toHaveBeenCalled();
  });

  it("returns a clear error when extractProductInfoFromText cannot identify a product", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: true, normalized: "https://example.com/x" });
    (fetchAndExtractText as jest.Mock).mockResolvedValue({ title: "", text: "texto irrelevante" });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeUrlRequest("https://example.com/x"));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/listings-analyze-source-route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/listings/analyze-source/route'"

- [ ] **Step 3: Implement**

```ts
// src/app/api/listings/analyze-source/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateUrlSSRF } from "@/lib/security/ssrf";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";
import { log } from "@/lib/logger";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;

export async function POST(req: Request) {
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

    const formData = await req.formData();
    const url = formData.get("url");
    const file = formData.get("file");

    let extractedText: string;

    if (typeof url === "string" && url.trim()) {
      const check = await validateUrlSSRF(url.trim());
      if (!check.ok) {
        return NextResponse.json({ error: check.error ?? "URL no válida" }, { status: 400 });
      }
      const page = await fetchAndExtractText(check.normalized!);
      extractedText = page.text;
    } else if (file instanceof File) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
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
            error: "Este PDF parece ser una imagen escaneada — no pudimos leer texto seleccionable.",
            scannedPdf: true,
          },
          { status: 422 }
        );
      }
      extractedText = pdf.text;
    } else {
      return NextResponse.json({ error: "Debes indicar una URL o subir un PDF" }, { status: 400 });
    }

    const productInfo = await extractProductInfoFromText(extractedText);
    if (!productInfo) {
      return NextResponse.json(
        { error: "No pudimos identificar un producto en esta fuente. Prueba con otra URL o PDF, o crea el producto manualmente." },
        { status: 422 }
      );
    }

    return NextResponse.json({ productInfo });
  } catch (error) {
    log.error({ err: error }, "analyze-source error");
    return NextResponse.json({ error: "Error al analizar la fuente" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/listings-analyze-source-route.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 errors, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/listings/analyze-source/route.ts __tests__/unit/listings-analyze-source-route.test.ts
git commit -m "feat: add analyze-source endpoint for URL/PDF product analysis (no charge)"
```

---

### Task 4: Create endpoint — `POST /api/listings/create-from-source`

**Files:**
- Create: `src/app/api/listings/create-from-source/route.ts`
- Test: `__tests__/unit/listings-create-from-source-route.test.ts`

**Interfaces:**
- Consumes: `useCredits`/`addCredits` (`@/lib/credits/use-credits`), `MODE_CONFIG`/`GenerationMode` (`@/lib/ai/prompts`), `sendTriggerEvent` (Task 1).
- Produces: `POST /api/listings/create-from-source` — accepts `{ productName, category, attributes, primaryKeyword, mode, marketplace?, priceSegment? }` (the confirmed/edited preview from Task 3, plus the dashboard's currently-selected generation settings). Returns `{ success: true, listingId, remainingCredits }` on success. Consumed by Task 5 (UI).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/unit/listings-create-from-source-route.test.ts
import { POST } from "@/app/api/listings/create-from-source/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(), currentUser: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn(), addCredits: jest.fn() }));
jest.mock("@/lib/trigger/send-batch-event", () => ({ sendTriggerEvent: jest.fn() }));

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/db", () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  },
  schema: { listings: {} },
}));

import { auth, currentUser } from "@clerk/nextjs/server";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { sendTriggerEvent } from "@/lib/trigger/send-batch-event";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/listings/create-from-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  productName: "Persiana Veneciana Aluminio",
  category: "hogar",
  attributes: { material: "aluminio" },
  primaryKeyword: "persiana veneciana",
  mode: "creative",
};

describe("POST /api/listings/create-from-source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (currentUser as jest.Mock).mockResolvedValue({ emailAddresses: [{ emailAddress: "a@b.com" }] });
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 9 });
    (sendTriggerEvent as jest.Mock).mockResolvedValue({});
    mockInsert.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (missing productName)", async () => {
    const res = await POST(makeRequest({ ...validBody, productName: "" }));
    expect(res.status).toBe(400);
  });

  it("charges 1 credit for creative mode and creates the listing", async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(useCredits).toHaveBeenCalledWith("user-1", 1, expect.any(String));
    expect(mockInsert).toHaveBeenCalled();
    expect(sendTriggerEvent).toHaveBeenCalled();
  });

  it("charges 2 credits for tecnica mode", async () => {
    await POST(makeRequest({ ...validBody, mode: "tecnica" }));
    expect(useCredits).toHaveBeenCalledWith("user-1", 2, expect.any(String));
  });

  it("returns 402 without creating a listing when credits are insufficient", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(402);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("refunds credits and marks the listing FAILED when the trigger dispatch fails", async () => {
    (sendTriggerEvent as jest.Mock).mockRejectedValue(new Error("TRIGGER_FAILED"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    expect(addCredits).toHaveBeenCalledWith("user-1", 1, "refund", expect.any(String));
    expect(mockUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/listings-create-from-source-route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/listings/create-from-source/route'"

- [ ] **Step 3: Implement**

```ts
// src/app/api/listings/create-from-source/route.ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { MODE_CONFIG, type GenerationMode } from "@/lib/ai/prompts";
import { sendTriggerEvent } from "@/lib/trigger/send-batch-event";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  productName: z.string().min(1).max(500),
  category: z.string().min(1),
  attributes: z.record(z.string()).optional(),
  primaryKeyword: z.string().optional(),
  mode: z.string(),
  marketplace: z.string().optional(),
  priceSegment: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de entrada no válidos" }, { status: 400 });
    }
    const body = parsed.data;
    const mode = (body.mode && body.mode in MODE_CONFIG ? body.mode : "creative") as GenerationMode;
    const creditsRequired = MODE_CONFIG[mode]?.creditsPerProduct ?? 1;

    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(userId, creditsRequired, "Creación de producto desde URL/PDF");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: `No tienes suficientes créditos. Necesitas ${creditsRequired}.` },
        { status: 402 }
      );
    }

    const listingId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.listings).values({
      id: listingId,
      userId,
      productName: body.productName,
      category: body.category,
      attributes: body.attributes ?? null,
      marketplace: body.marketplace ?? null,
      priceSegment: body.priceSegment ?? null,
      primaryKeyword: body.primaryKeyword ?? null,
      status: "PENDING",
      generatedTitle: null,
      generatedBullets: null,
      generatedDescription: null,
      errorMessage: null,
      createdAt: now,
    });

    const batchId = uuidv4();
    try {
      await sendTriggerEvent(userId, batchId, mode, "groq", userEmail);
    } catch (triggerError) {
      await addCredits(userId, creditsRequired, "refund", "Reembolso por error al crear producto desde URL/PDF");
      await db
        .update(schema.listings)
        .set({ status: "FAILED", errorMessage: "Error al iniciar procesamiento. Puedes reintentar." })
        .where(eq(schema.listings.id, listingId));
      log.error({ err: triggerError, userId, listingId }, "create-from-source: trigger dispatch failed");
      return NextResponse.json(
        { error: "No se pudo iniciar el procesamiento. Inténtalo de nuevo en unos segundos." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, listingId, remainingCredits: creditResult.remainingCredits });
  } catch (error) {
    log.error({ err: error }, "create-from-source: unhandled error");
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/listings-create-from-source-route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 errors, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/listings/create-from-source/route.ts __tests__/unit/listings-create-from-source-route.test.ts
git commit -m "feat: add create-from-source endpoint (charges credit, triggers generation)"
```

---

### Task 5: Dashboard UI — "Crear desde URL o PDF" component

**Files:**
- Create: `src/components/CreateFromSourceForm.tsx`
- Modify: `src/app/dashboard/page.tsx` (add the import, render the component below the CSV upload area, wire `onListingCreated` to refresh the table)

**Interfaces:**
- Consumes: `POST /api/listings/analyze-source` and `POST /api/listings/create-from-source` (Tasks 3, 4).
- Produces: `<CreateFromSourceForm selectedMode marketplace priceSegment onListingCreated />` component.

- [ ] **Step 1: Create the component**

```tsx
// src/components/CreateFromSourceForm.tsx
"use client";

import { useRef, useState } from "react";

interface ProductInfo {
  productName: string;
  category: string;
  attributes: Record<string, string>;
  primaryKeyword: string;
  confidence: number;
}

interface Props {
  selectedMode: string;
  marketplace: string;
  priceSegment: string;
  onListingCreated: () => void;
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.75 ? "bg-green-500" : value >= 0.45 ? "bg-yellow-400" : "bg-red-500";
  const label = value >= 0.75 ? "Alta confianza" : value >= 0.45 ? "Confianza media" : "Baja confianza";
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-500">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label} ({Math.round(value * 100)}%)
    </span>
  );
}

export default function CreateFromSourceForm({ selectedMode, marketplace, priceSegment, onListingCreated }: Props) {
  const [tab, setTab] = useState<"url" | "pdf">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "analyzing" | "preview" | "creating" | "error">("idle");
  const [info, setInfo] = useState<ProductInfo | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedAttributes, setEditedAttributes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setState("idle");
    setInfo(null);
    setEditedName("");
    setEditedAttributes({});
    setError(null);
    setUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (tab === "url" && !url.trim()) return;
    if (tab === "pdf" && !file) return;
    setState("analyzing");
    setError(null);
    const fd = new FormData();
    if (tab === "url") fd.append("url", url.trim());
    else if (file) fd.append("file", file);

    try {
      const res = await fetch("/api/listings/analyze-source", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo analizar la fuente.");
        setState("error");
        return;
      }
      setInfo(data.productInfo);
      setEditedName(data.productInfo.productName);
      setEditedAttributes(data.productInfo.attributes ?? {});
      setState("preview");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("error");
    }
  }

  async function handleCreate() {
    if (!info) return;
    setState("creating");
    setError(null);
    try {
      const res = await fetch("/api/listings/create-from-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: editedName || info.productName,
          category: info.category,
          attributes: editedAttributes,
          primaryKeyword: info.primaryKeyword,
          mode: selectedMode,
          marketplace,
          priceSegment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el producto.");
        setState("error");
        return;
      }
      reset();
      onListingCreated();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("error");
    }
  }

  return (
    <div className="w-full space-y-3">
      <p className="text-sm font-medium text-gray-700">o crea un producto desde una URL o un PDF</p>

      {(state === "idle" || state === "error") && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("url")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "url" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              🔗 Pegar URL
            </button>
            <button
              onClick={() => setTab("pdf")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "pdf" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              📄 Subir PDF
            </button>
          </div>

          {tab === "url" ? (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://proveedor.com/ficha-del-producto"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          )}

          <button
            onClick={handleAnalyze}
            disabled={(tab === "url" && !url.trim()) || (tab === "pdf" && !file) || (state as string) === "analyzing"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {state === "analyzing" ? "Analizando..." : "Analizar"}
          </button>
          {state === "error" && error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {state === "analyzing" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Analizando fuente...
        </div>
      )}

      {(state === "preview" || state === "creating") && info && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre del producto</label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
              {info.category}
            </span>
          </div>

          {Object.keys(editedAttributes).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Atributos</p>
              <div className="space-y-1.5">
                {Object.entries(editedAttributes).map(([key, value]) => (
                  <div key={key} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 w-24 shrink-0 capitalize">{key}</span>
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      value={value}
                      onChange={(e) => setEditedAttributes((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <ConfidenceDot value={info.confidence} />
          {info.confidence < 0.45 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Confianza baja — revisa todos los campos antes de crear el producto.
            </p>
          )}

          <p className="text-xs text-gray-400">
            Esto creará el producto y consumirá {selectedMode === "tecnica" ? "2 créditos" : "1 crédito"} para generar su ficha.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={state === "creating"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {state === "creating" ? "Creando..." : "Crear producto →"}
            </button>
            <button
              onClick={reset}
              disabled={state === "creating"}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the component into the dashboard**

In `src/app/dashboard/page.tsx`, add this import at the top (alongside the other component imports):

```tsx
import CreateFromSourceForm from "@/components/CreateFromSourceForm";
```

Find the end of the "Subir CSV" upload area (search for the closing of the upload-area `<div>` block, right before the `{/* Mode selector */}` comment — read the current file to find the exact line) and insert, right after it and before the mode selector:

```tsx
        <CreateFromSourceForm
          selectedMode={selectedMode}
          marketplace={marketplace}
          priceSegment={priceSegment}
          onListingCreated={() => fetchListings()}
        />
```

This must be inserted as a sibling of the CSV upload area's outer `<div>`, not nested inside it — read the surrounding JSX structure carefully (indentation level) before inserting, since `dashboard/page.tsx` is a large file and this must be a surgical, correctly-nested insertion.

- [ ] **Step 3: Run full verification**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 errors, all suites pass (no new tests required for this UI wiring, matching this project's established precedent for dashboard-page changes and matching the old `PhotoUploader`'s lack of a component test — this codebase has no React component testing infrastructure, confirmed in an earlier round of this same feature).

- [ ] **Step 4: Confirm the dashboard/page.tsx diff is surgical**

Run: `git diff --stat src/app/dashboard/page.tsx` (before committing) and confirm only a small number of lines changed (one import + one component render), not a sprawling diff.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreateFromSourceForm.tsx src/app/dashboard/page.tsx
git commit -m "feat: add Crear-desde-URL-o-PDF form below CSV upload in the dashboard"
```

---

### Task 6: Final verification and staging deployment

**Files:** none (verification + deployment steps only)

- [ ] **Step 1: Full verification suite**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 TypeScript errors, all test suites pass (5 new/modified test files + all pre-existing ones from the rest of Input Enriquecido).

- [ ] **Step 2: Production build check**

Run: `npm run build`
Expected: "Compiled successfully" (pre-existing local-env limitations around missing Clerk/Upstash keys during static generation are expected and unrelated, per this feature's prior sessions).

- [ ] **Step 3: Merge to staging and push**

This work happens directly on `feature/input-enriquecido` (already checked out in this worktree, already tracking the state currently on `staging`). Push directly:

```bash
git push origin feature/input-enriquecido:staging
git fetch origin staging:staging
```

- [ ] **Step 4: Redeploy Trigger.dev**

`process-products.ts` is NOT modified by this plan (the new flow reuses the existing `process-batch` task unmodified — it just inserts a `PENDING` listing and triggers the same task the CSV upload already uses), so **no Trigger.dev redeploy is required for this specific addition**. Confirm this assumption by checking `git diff --stat` across all commits in this plan — if `src/trigger/jobs/process-products.ts` does not appear in the diff, no redeploy is needed. If it unexpectedly does, redeploy via `npm run trigger:deploy` before proceeding.

- [ ] **Step 5: Manual verification in staging**

Test the "Pegar URL" tab with a real product URL (competitor or own listing) and the "Subir PDF" tab with a real supplier spec-sheet PDF — ideally one from Javier's actual domain (persianas/mosquiteras/mobiliario a medida) once he provides one, per this feature's design doc. Confirm: analysis shows a sensible preview with a confidence indicator, editing works, confirming creates the listing and it completes generation normally, and the low-confidence warning appears when appropriate (test with a deliberately noisy/unclear source to trigger it).

- [ ] **Step 6: Report to the user**

Do not merge to `main`. Report completion and the manual-verification checklist back to the user before inviting Javier to test all flows (URL/PDF-create, CSV, "📎 Enriquecer", Ficha Técnica) together.
