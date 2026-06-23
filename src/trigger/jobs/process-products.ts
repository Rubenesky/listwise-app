import { task, retry } from "@trigger.dev/sdk/v3";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { groq } from "@/lib/ai/client-groq";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import type { GeneratedContent, BatchProcessPayload } from "@/types";

const generatedContentSchema = z.object({
  title: z.string().max(60),
  bullets: z.array(z.string()).length(5),
  description: z.string(),
});

function parseAiResponse(text: string): GeneratedContent {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se encontró JSON en la respuesta");
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
    console.log(`[process-batch] ▶ Iniciando para userId: ${payload.userId}`);
    const { userId } = payload;

    let pendingListings: Awaited<ReturnType<typeof db.select>>[];
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
                { role: "user", content: buildUserPrompt({
                  productName: safeName,
                  category: safeCategory,
                  attributes: product.attributes as Record<string, string> | null,
                })},
              ],
              temperature: 0.7,
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
          const msg = parseError instanceof Error ? parseError.message : "JSON parse error";
          await markFailed(product.id, `Invalid AI response format: ${msg}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        await markFailed(product.id, `API error: ${msg}`);
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