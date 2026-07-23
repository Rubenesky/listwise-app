import { task, retry } from "@trigger.dev/sdk/v3";
import { sendEmail } from "@/lib/email/send";
import { listingReadyTemplate } from "@/lib/email/templates";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SYSTEM_PROMPT, buildUserPromptWithVoice, MODE_CONFIG, type GenerationMode, type VoiceProfileData, type Marketplace, type PriceSegment } from "@/lib/ai/prompts";
import { providers, getAIResponse, type AIProvider } from "@/lib/ai/providers";
import type { GeneratedContent, BatchProcessPayload } from "@/types";
import { trackGamification } from "@/lib/gamification/track";
import { log } from "@/lib/logger";

const qualityFlagsSchema = z.object({
  no_trademarks: z.boolean().optional(),
  title_in_range: z.boolean().optional(),
  bullets_concise: z.boolean().optional(),
  attrs_real: z.boolean().optional(),
  hook_differentiated: z.boolean().optional(),
}).optional();

const generatedContentSchema = z.object({
  title: z.string().transform((s) => s.slice(0, 100)),
  title_b: z.string().transform((s) => s.slice(0, 100)).optional(),
  bullets: z.array(z.string()).min(1).max(10),
  description: z.string().min(1),
  primary_keyword: z.string().max(100).optional(),
  target_audience: z.string().max(100).optional(),
  hook_type: z.enum(["scene", "question", "bold", "benefit"]).optional(),
  quality_flags: qualityFlagsSchema,
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
    log.info({ userId: payload.userId }, "Iniciando proceso de batch");
    const { userId, mode, provider, userEmail } = payload;
    const safeMode = (mode && mode in MODE_CONFIG ? mode : "creative") as GenerationMode;
    const safeProvider = (provider && provider in providers ? provider : "groq") as AIProvider;
    const aiConfig = providers[safeProvider];
    log.info({ userId, provider: safeProvider, model: aiConfig.defaultModel }, "Proveedor AI seleccionado");
    const temperature = MODE_CONFIG[safeMode].temperature;
    // Ficha Técnica produces a much longer, multi-section description
    const maxTokens = safeMode === "tecnica" ? 3000 : 1600;

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

    let pendingListings: Pick<typeof schema.listings.$inferSelect, "id" | "productName" | "category" | "attributes" | "marketplace" | "priceSegment">[];
    try {
      pendingListings = await db
        .select({
          id: schema.listings.id,
          productName: schema.listings.productName,
          category: schema.listings.category,
          attributes: schema.listings.attributes,
          marketplace: schema.listings.marketplace,
          priceSegment: schema.listings.priceSegment,
        })
        .from(schema.listings)
        .where(
          and(
            eq(schema.listings.userId, userId),
            eq(schema.listings.status, "PENDING")
          )
        );
    } catch (dbError) {
      log.error({ userId, err: dbError }, "Error al consultar la BD");
      throw dbError;
    }

    log.info({ userId, count: pendingListings.length }, "Listings PENDING encontrados");

    if (pendingListings.length === 0) {
      log.info({ userId }, "No hay listings PENDING");
      return { processed: 0, message: "No pending listings found." };
    }

    const listingIds = pendingListings.map((l) => l.id);
    await db.update(schema.listings)
      .set({ status: "PROCESSING" })
      .where(inArray(schema.listings.id, listingIds));

    let totalProcessed = 0;
    const succeededListings: typeof pendingListings = [];

    for (const product of pendingListings) {
      try {
        const safeName = product.productName.slice(0, 200).replace(/[<>]/g, "");
        const safeCategory = product.category?.slice(0, 50) ?? null;

        const response = await retry.onThrow(
          async () => {
            return await getAIResponse(
              [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserPromptWithVoice(
                  {
                    productName: safeName,
                    category: safeCategory,
                    attributes: product.attributes as Record<string, string> | null,
                    mode: safeMode,
                    marketplace: (product.marketplace as Marketplace | undefined) ?? undefined,
                    priceSegment: (product.priceSegment as PriceSegment | undefined) ?? undefined,
                  },
                  activeVoiceProfile
                )},
              ],
              safeProvider,
              { temperature, max_tokens: maxTokens, response_format: { type: "json_object" } }
            );
          },
          { maxAttempts: 3, minTimeoutInMs: 2000, factor: 2 }
        );

        const completion = response as { choices: { message: { content: string | null } }[] };
        const text = completion.choices[0]?.message?.content || "";

        try {
          const generated = parseAiResponse(text);
          await db
            .update(schema.listings)
            .set({
              status: "COMPLETED",
              generatedTitle: generated.title,
              generatedTitleB: generated.title_b ?? null,
              generatedBullets: generated.bullets,
              generatedDescription: generated.description,
              primaryKeyword: generated.primary_keyword ?? null,
              targetAudience: generated.target_audience ?? null,
              hookType: generated.hook_type ?? null,
              qualityFlags: generated.quality_flags ?? null,
              promptVersion: "3.0",
              errorMessage: null,
            })
            .where(eq(schema.listings.id, product.id));
          totalProcessed++;
          succeededListings.push(product);
          trackGamification(userId, "complete_product").catch((e) => log.warn({ err: e }, "trackGamification failed"));
        } catch (parseError) {
          log.error({ userId, productId: product.id, err: parseError }, "Error al parsear respuesta IA");
          await markFailed(product.id, humanizeError(parseError));
        }
      } catch (error) {
        await markFailed(product.id, humanizeError(error));
      }

    }

    if (userEmail && totalProcessed > 0) {
      const productNames = succeededListings
        .map((l) => l.productName)
        .slice(0, 10);
      await sendEmail({
        to: userEmail,
        subject: `✅ Tus ${totalProcessed} listing${totalProcessed === 1 ? "" : "s"} ya están listos — ListWise`,
        html: listingReadyTemplate({ count: totalProcessed, productNames }),
      });
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