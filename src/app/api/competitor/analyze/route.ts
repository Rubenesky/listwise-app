import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { ratelimitCompetitor } from "@/lib/rate-limit";

// ─── URL Security Validation ────────────────────────────────────────────────

const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i;

function validateCompetitorUrl(raw: string): { ok: boolean; error?: string } {
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
  if (PRIVATE_IP_RE.test(host)) {
    return { ok: false, error: "No se permiten direcciones internas o localhost" };
  }
  // Block raw IPv4 to prevent SSRF
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IP directas" };
  }
  return { ok: true };
}

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
  listingId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // CSRF: verify request origin
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && !origin.includes(host.split(":")[0])) {
      console.warn(`⚠️ [Competitor] Origin mismatch: ${origin} vs ${host}`);
      return NextResponse.json({ error: "Solicitud no permitida" }, { status: 403 });
    }

    // Rate limit: 5 per user per day
    const { success } = await ratelimitCompetitor.limit(`competitor:${userId}`);
    if (!success) {
      return NextResponse.json(
        { error: "Has alcanzado el límite de 5 análisis por día." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { url: rawUrl, listingId } = parsed.data;

    const urlCheck = validateCompetitorUrl(rawUrl);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }

    const normalizedUrl = new URL(rawUrl).href;
    const now = Math.floor(Date.now() / 1000);

    // Cache check: reuse COMPLETED analysis from last 24h for same URL
    const [cached] = await db
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
      console.log(`💾 [Competitor] Cache hit: ${normalizedUrl}`);
      return NextResponse.json({ analysisId: cached.id, cached: true });
    }

    // Fetch optional listing for comparison context
    let listingTitle: string | undefined;
    let listingDescription: string | undefined;
    if (listingId) {
      const [listing] = await db
        .select({ generatedTitle: schema.listings.generatedTitle, generatedDescription: schema.listings.generatedDescription })
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
      console.error("❌ [Competitor] Trigger falló:", triggerRes.status);
      await db
        .update(schema.competitorAnalyses)
        .set({ status: "FAILED", errorMessage: "Error al iniciar análisis" })
        .where(eq(schema.competitorAnalyses.id, analysisId));
      return NextResponse.json({ error: "No se pudo iniciar el análisis" }, { status: 503 });
    }

    console.log(`🚀 [Competitor] Análisis iniciado: ${analysisId}`);
    return NextResponse.json({ analysisId, cached: false });
  } catch (error) {
    console.error("❌ [Competitor] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
