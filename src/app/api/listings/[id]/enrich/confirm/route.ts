import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { buildSystemPrompt, buildUserPromptWithVoice, MODE_CONFIG, type GenerationMode, type VoiceProfileData, type Marketplace, type PriceSegment } from "@/lib/ai/prompts";
import { getAIResponse, getDefaultProvider } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  sourceId: z.string().min(1),
  editedSpecs: z.record(z.string()),
  consent: z.literal(true),
});

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

    // Fetch active voice profile — non-fatal if the lookup fails, matching
    // process-products.ts's convention (proceed with null rather than fail
    // the whole request over a voice-profile lookup issue).
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

    try {
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
                marketplace: (listing.marketplace as Marketplace | undefined) ?? undefined,
                priceSegment: (listing.priceSegment as PriceSegment | undefined) ?? undefined,
              },
              activeVoiceProfile
            ),
          },
        ],
        getDefaultProvider(),
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
          primaryKeyword: generated.primary_keyword ?? null,
          targetAudience: generated.target_audience ?? null,
          hookType: generated.hook_type ?? null,
          qualityFlags: generated.quality_flags ?? null,
          promptVersion: "3.0",
          status: "COMPLETED",
        })
        .where(eq(schema.listings.id, id));

      return NextResponse.json({ success: true, remainingCredits: creditResult.remainingCredits });
    } catch (aiError) {
      // Credits were already charged above — refund before surfacing the
      // error, matching src/app/api/upload/route.ts's refund-on-failure
      // convention.
      await addCredits(userId, creditsRequired, "refund", "Reembolso por error al regenerar con fuente enriquecida");
      throw aiError;
    }
  } catch (error) {
    log.error({ err: error }, "Listing enrich confirm error");
    return NextResponse.json({ error: "Error al regenerar el producto" }, { status: 500 });
  }
}
