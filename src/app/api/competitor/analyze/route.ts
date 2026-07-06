import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { promises as dns, LookupAddress } from "dns";
import { useCredits } from "@/lib/credits/use-credits";
import { ratelimitCompetitor } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

// ─── SSRF Protection — DNS-based validation ─────────────────────────────────

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

async function validateUrlSSRF(
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

  // Fast-path: reject obvious cases before DNS
  if (/^localhost$/i.test(host) || /^0\.0\.0\.0$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones internas" };
  }
  // Block raw IPv4 (no DNS needed)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IP directas" };
  }
  // Block raw IPv6 brackets e.g. [::1]
  if (/^\[/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IPv6 directas" };
  }

  // DNS resolution: resolve ALL addresses and reject if any is private
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

// ─── CSRF Protection — exact host comparison ────────────────────────────────

const ALLOWED_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
})();

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // No early-return for missing Origin: Clerk auth is the primary protection,
  // but we also enforce origin matching for browser clients to prevent CSRF
  // credit-drain. Non-browser server-to-server callers should rely on Clerk.
  if (!origin) return false;
  try {
    // Exact host comparison prevents substring bypass (evil.com?listwise.app)
    return new URL(origin).host === ALLOWED_HOST;
  } catch {
    return false;
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
  listingId: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { success: rlOk } = await ratelimitCompetitor.limit(userId);
    if (!rlOk) {
      return NextResponse.json({ error: "Límite diario de análisis alcanzado (5/día). Inténtalo mañana." }, { status: 429 });
    }

    if (!checkOrigin(req)) {
      log.warn({ userId }, "Competitor analyze: origin mismatch");
      return NextResponse.json({ error: "Solicitud no permitida" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { url: rawUrl, listingId, forceRefresh } = parsed.data;

    // SSRF: DNS-based validation (resolves all IPs, rejects private ranges)
    const urlCheck = await validateUrlSSRF(rawUrl);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }

    const normalizedUrl = urlCheck.normalized!;
    const now = Math.floor(Date.now() / 1000);

    // Cache hit: reuse COMPLETED analysis from last 24h (skipped when forceRefresh)
    const [cached] = forceRefresh ? [] : await db
      .select({ id: schema.competitorAnalyses.id })
      .from(schema.competitorAnalyses)
      .where(
        and(
          eq(schema.competitorAnalyses.userId, userId),
          eq(schema.competitorAnalyses.url, normalizedUrl),
          eq(schema.competitorAnalyses.status, "COMPLETED"),
          gt(schema.competitorAnalyses.cacheExpiresAt, now)
        )
      )
      .limit(1);

    if (cached) {
      log.info({ userId, analysisId: cached.id }, "Competitor analyze: cache hit");
      return NextResponse.json({ analysisId: cached.id, cached: true });
    }

    // Credit check: 2 credits required for a new analysis
    const creditResult = await useCredits(userId, 2, "Análisis de competidor");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "No tienes suficientes créditos. Necesitas 2 créditos para analizar un competidor." },
        { status: 402 }
      );
    }

    // Optional: fetch listing context for comparison
    let listingTitle: string | undefined;
    let listingDescription: string | undefined;
    if (listingId) {
      const [listing] = await db
        .select({
          generatedTitle: schema.listings.generatedTitle,
          generatedDescription: schema.listings.generatedDescription,
        })
        .from(schema.listings)
        .where(and(eq(schema.listings.id, listingId), eq(schema.listings.userId, userId)))
        .limit(1);
      if (listing?.generatedTitle) {
        listingTitle = listing.generatedTitle;
        listingDescription = listing.generatedDescription ?? undefined;
      }
    }

    const analysisId = uuidv4();
    await db.insert(schema.competitorAnalyses).values({
      id: analysisId,
      userId,
      listingId: listingId ?? null,
      url: normalizedUrl,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    const triggerRes = await fetch(
      "https://api.trigger.dev/api/v1/tasks/analyze-competitor/trigger",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
        },
        body: JSON.stringify({
          payload: { analysisId, url: normalizedUrl, userId, listingTitle, listingDescription },
        }),
      }
    );

    if (!triggerRes.ok) {
      log.error({ userId, status: triggerRes.status }, "Competitor analyze: Trigger.dev failed");
      await db
        .update(schema.competitorAnalyses)
        .set({ status: "FAILED", errorMessage: "Error al iniciar análisis" })
        .where(eq(schema.competitorAnalyses.id, analysisId));
      return NextResponse.json({ error: "No se pudo iniciar el análisis" }, { status: 503 });
    }

    log.info({ userId, analysisId }, "Competitor analysis started");
    return NextResponse.json({ analysisId, cached: false, remainingCredits: creditResult.remainingCredits });
  } catch (error) {
    log.error({ err: error }, "Competitor analyze error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
