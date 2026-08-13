import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { ratelimitAudioGeneration } from "@/lib/rate-limit";
import { generateSpeech } from "@/lib/ai/client-gemini-tts";
import { generateSpokenScript } from "@/lib/ai/generate-audio-script";
import { log } from "@/lib/logger";

const AUDIO_CREDITS = 2;

// Generates a downloadable audio version of a listing (title + bullets +
// description) on demand — deliberately NOT persisted anywhere. The response
// IS the file; once the browser downloads it, this endpoint isn't involved
// again. No blob storage, no cache invalidation to worry about.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { success: withinLimit } = await ratelimitAudioGeneration.limit(userId);
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Límite diario de generación de audio alcanzado. Inténtalo mañana." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);
    if (!listing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const title = listing.generatedTitle ?? listing.productName;
    const bullets = (listing.generatedBullets as string[] | null) ?? [];
    const description = listing.generatedDescription ?? "";
    if (!title && bullets.length === 0 && !description) {
      return NextResponse.json(
        { error: "Este producto todavía no tiene contenido generado." },
        { status: 422 }
      );
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(userId, AUDIO_CREDITS, "Generar audio del listing");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "No tienes créditos suficientes para generar el audio.", upsell: true },
        { status: 402 }
      );
    }

    try {
      // Feeding the raw listing straight into TTS reads like a spec sheet —
      // rewrite it into a proper spoken sales script first (see
      // generate-audio-script.ts for the reasoning, backed by a real
      // listening review of the previous raw-concatenation approach).
      const script = await generateSpokenScript({ title, bullets, description });
      const { buffer, mimeType } = await generateSpeech(script);
      log.info({ userId, listingId: id, bytes: buffer.length }, "Audio de listing generado");

      const filename = `${(listing.productName || "listing").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.wav`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Filename": filename,
          "X-Remaining-Credits": String(creditResult.remainingCredits),
        },
      });
    } catch (ttsError) {
      // Credit was already charged above — refund it since no audio was
      // produced, matching the refund-on-failure convention used everywhere
      // else credits are pre-deducted.
      await addCredits(userId, AUDIO_CREDITS, "refund", "Reembolso por error al generar audio").catch(
        (e) => log.warn({ err: e }, "Credit refund failed")
      );
      log.error({ err: ttsError, userId, listingId: id }, "listings/audio TTS error");
      return NextResponse.json({ error: "Error al generar el audio. Inténtalo de nuevo." }, { status: 500 });
    }
  } catch (error) {
    log.error({ err: error }, "listings/audio error");
    return NextResponse.json({ error: "Error al generar el audio." }, { status: 500 });
  }
}
