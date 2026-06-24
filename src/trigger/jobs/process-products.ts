import { task, retry } from "@trigger.dev/sdk/v3";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { groq } from "@/lib/ai/client-groq";
import { SYSTEM_PROMPT, buildUserPromptWithVoice, MODE_CONFIG, type GenerationMode, type VoiceProfileData } from "@/lib/ai/prompts";
import type { GeneratedContent, BatchProcessPayload } from "@/types";

const generatedContentSchema = z.object({
  title: z.string().transform((s) => s.slice(0, 80)),
  bullets: z.array(z.string()).min(1).max(10),
  description: z.string().min(1),
});

function humanizeError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo procesar este producto. Inténtalo de nuevo.";
  const msg = error.message.toLowerCase();
  if (msg.includes("too_big") || msg.includes("maximum")) {
    return "La IA generó una respuesta demasiado larga. Inténtalo de nuevo.";
  }
  if (msg.includes("bullets") || msg.includes("array") || msg.includes("length")) {
    return "La IA no generó los puntos clave en el formato esperado. Inténtalo de nuevo.";
  }
  if (msg.includes("json") || msg.includes("parse") || msg.includes("unexpected token")) {
    return "La IA devolvió una respuesta que no pudimos interpretar. Inténtalo de nuevo.";
  }
  if (msg.includes("rate_limit") || msg.includes("429") || msg.includes("too many")) {
    return "Se superó el límite de solicitudes a la IA. Espera unos segundos e inténtalo de nuevo.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "La IA tardó demasiado en responder. Inténtalo de nuevo.";
  }
  if (msg.includes("connection") || msg.includes("network") || msg.includes("fetch")) {
    return "Error de conexión con el servicio de IA. Comprueba tu conexión e inténtalo de nuevo.";
  }
  return "Algo salió mal al generar el contenido. Inténtalo de nuevo.";
}

function parseAiResponse(text: string): GeneratedContent {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("La IA no devolvió datos en el formato correcto.");
  }
  const cleaned = jsonMatch[0];
  const parsed = JSON.parse(cleaned) as unknown;
  return generatedContentSchema.parse(parsed);
}

export const processProductsTask = task({
  id: "process-batch",
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (payload: BatchProcessPayload) => {
    console.log(`📦 [Trigger] Procesando batch para usuario: ${payload.userId}`);
    console.log(`[process-batch] ▶ Iniciando para userId: ${payload.userId}`);
    const { userId, mode } = payload;
    const safeMode = (mode && mode in MODE_CONFIG ? mode : "creative") as GenerationMode;
    const temperature = MODE_CONFIG[safeMode].temperature;

    // Fetch active voice profile once (before the loop)
    let activeVoiceProfile: VoiceProfileData | null = null;
    try {
      const [vp] = await db
        .select()
        .from(schema.voiceProfiles)
        .where(and(eq(schema.voiceProfiles.userId, userId), eq(schema.voiceProfiles.isActive, 1)))
        .limit(1);
      if (vp) activeVoiceProfile = vp.profile as VoiceProfileData;
    } catch {
      // Non-fatal — proceed without voice profile
    }

    let pendingListings: (typeof schema.listings.$inferSelect)[];
    try {
      pendingListings = await db
        .select()
        .from(schema.listings)
        .where(
          and(
            eq(schema.listings.userId, userId),
            eq(schema.listings.status, "PENDING")
          )
        ) as any;
    } catch (dbError) {
      console.error("[process-batch] ❌ Error al consultar la BD:", dbError);
      throw dbError;
    }

    console.log(`📦 [Trigger] Productos pendientes: ${pendingListings.length}`);
    console.log(`[process-batch] Listings PENDING encontrados: ${pendingListings.length}`);

    if (pendingListings.length === 0) {
      console.log(`[process-batch] ℹ️ No hay listings PENDING para userId: ${userId}`);
      return { processed: 0, message: "No pending listings found." };
    }

    const listingIds = pendingListings.map((l) => l.id);
    await Promise.all(
      listingIds.map((id) =>
        db
          .update(schema.listings)
          .set({ status: "PROCESSING" })
          .where(eq(schema.listings.id, id))
      )
    );

    let totalProcessed = 0;

    for (const product of pendingListings) {
      try {
        const safeName = product.productName.slice(0, 200).replace(/[<>]/g, "");
        const safeCategory = product.category?.slice(0, 50) ?? null;

        const response = await retry.onThrow(
          async () => {
            return await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserPromptWithVoice(
                  {
                    productName: safeName,
                    category: safeCategory,
                    attributes: product.attributes as Record<string, string> | null,
                    mode: safeMode,
                  },
                  activeVoiceProfile
                )},
              ],
              temperature,
              max_tokens: 1024,
              response_format: { type: "json_object" },
            });
          },
          { maxAttempts: 3, minTimeoutInMs: 2000, factor: 2 }
        );

        const text = response.choices[0]?.message?.content || "";

        try {
          const generated = parseAiResponse(text);
          await db
            .update(schema.listings)
            .set({
              status: "COMPLETED",
              generatedTitle: generated.title,
              generatedBullets: generated.bullets,
              generatedDescription: generated.description,
              errorMessage: null,
            })
            .where(eq(schema.listings.id, product.id));
          totalProcessed++;
        } catch (parseError) {
          await markFailed(product.id, humanizeError(parseError));
        }
      } catch (error) {
        await markFailed(product.id, humanizeError(error));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { processed: totalProcessed, total: pendingListings.length };
  },
});

async function markFailed(listingId: string, message: string): Promise<void> {
  await db
    .update(schema.listings)
    .set({ status: "FAILED", errorMessage: message })
    .where(eq(schema.listings.id, listingId));
}