import { task, retry } from "@trigger.dev/sdk/v3";
import { sendEmail } from "@/lib/email/send";
import { listingReadyTemplate } from "@/lib/email/templates";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { buildSystemPrompt, buildUserPromptWithVoice, getRequiredHookType, MODE_CONFIG, type GenerationMode, type VoiceProfileData, type Marketplace, type PriceSegment } from "@/lib/ai/prompts";
import { providers, getAIResponse, type AIProvider } from "@/lib/ai/providers";
import type { GeneratedContent, BatchProcessPayload } from "@/types";
import { trackGamification } from "@/lib/gamification/track";
import { log } from "@/lib/logger";
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { detectLanguageMismatch } from "@/lib/text/detect-language";
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { mergeAttributesWithPrecedence } from "@/lib/listings/merge-attributes";
import { generateWithContentRetry, truncateAtWordBoundary } from "@/lib/ai/generation-contract";

const qualityFlagsSchema = z.object({
  no_trademarks: z.boolean().optional(),
  title_in_range: z.boolean().optional(),
  bullets_concise: z.boolean().optional(),
  attrs_real: z.boolean().optional(),
  hook_differentiated: z.boolean().optional(),
}).optional();

const generatedContentSchema = z.object({
  title: z.string().transform((s) => truncateAtWordBoundary(s, 100)),
  title_b: z.string().transform((s) => truncateAtWordBoundary(s, 100)).optional(),
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

    // Batch-fetch all PENDING enriched sources for this batch's listings in
    // ONE query, instead of querying per-product inside the loop below.
    const pendingSourcesByListingId = new Map<string, typeof schema.enrichedSources.$inferSelect>();
    try {
      const pendingSourceRows = await db
        .select()
        .from(schema.enrichedSources)
        .where(
          and(
            inArray(schema.enrichedSources.listingId, listingIds),
            eq(schema.enrichedSources.status, "PENDING")
          )
        );
      for (const row of pendingSourceRows) {
        if (row.listingId) pendingSourcesByListingId.set(row.listingId, row);
      }
    } catch (lookupError) {
      log.warn(
        { userId, err: lookupError },
        "Batch enriched source lookup failed — continuing without it"
      );
    }

    let totalProcessed = 0;
    const succeededListings: typeof pendingListings = [];

    for (const product of pendingListings) {
      try {
        const safeName = product.productName.slice(0, 200).replace(/[<>]/g, "");
        const safeCategory = product.category?.slice(0, 50) ?? null;

        // Fuente enriquecida (URL desde CSV, ver Input Enriquecido): si hay
        // una fila PENDING para este listing, la procesamos ahora. Fallo aquí
        // nunca bloquea la generación — solo se pierde el contexto extra.
        let mergedAttributes = product.attributes as Record<string, string> | null;
        const pendingSource = pendingSourcesByListingId.get(product.id);

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
            try {
              await db
                .update(schema.enrichedSources)
                .set({ status: "FAILED", errorMessage: "No se pudo leer la fuente indicada" })
                .where(eq(schema.enrichedSources.id, pendingSource.id));
            } catch (markFailedError) {
              log.warn(
                { userId, listingId: product.id, err: markFailedError },
                "Enriched source FAILED-status write failed — continuing without it"
              );
            }
          }
        }

        const callAI = async () => {
          const response = await retry.onThrow(
            async () => {
              return await getAIResponse(
                [
                  { role: "system", content: buildSystemPrompt(safeMode) },
                  { role: "user", content: buildUserPromptWithVoice(
                    {
                      productName: safeName,
                      category: safeCategory,
                      attributes: mergedAttributes,
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
          return completion.choices[0]?.message?.content || "";
        };

        try {
          // Ficha Técnica has no bullets/word-count contract of this shape — only
          // the short-form modes (creative/professional/seo) are checked.
          const CONTENT_RETRY_ATTEMPTS = safeMode === "tecnica" ? 1 : 2;
          const generated = await generateWithContentRetry(
            async () => parseAiResponse(await callAI()),
            CONTENT_RETRY_ATTEMPTS,
            (attempt, result) =>
              log.warn(
                { userId, productId: product.id, attempt, bullets: result.bullets.length },
                "Generación no cumple el mínimo de bullets/palabras — reintentando"
              )
          );
          await db
            .update(schema.listings)
            .set({
              status: "COMPLETED",
              generationMode: safeMode,
              generatedTitle: generated.title,
              generatedTitleB: generated.title_b ?? null,
              generatedBullets: generated.bullets,
              generatedDescription: generated.description,
              primaryKeyword: generated.primary_keyword ?? null,
              targetAudience: generated.target_audience ?? null,
              hookType: getRequiredHookType(safeCategory) ?? generated.hook_type ?? null,
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