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
