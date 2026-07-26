import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { useCredits } from "@/lib/credits/use-credits";
import { buildSystemPrompt, buildUserPromptWithVoice, MODE_CONFIG, type GenerationMode } from "@/lib/ai/prompts";
import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  sourceId: z.string().min(1),
  editedSpecs: z.record(z.string()),
  consent: z.literal(true),
});

const generatedContentSchema = z.object({
  title: z.string().transform((s) => s.slice(0, 100)),
  title_b: z.string().transform((s) => s.slice(0, 100)).optional(),
  bullets: z.array(z.string()).min(1).max(10),
  description: z.string().min(1),
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
            },
            null
          ),
        },
      ],
      "groq",
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
        status: "COMPLETED",
      })
      .where(eq(schema.listings.id, id));

    return NextResponse.json({ success: true, remainingCredits: creditResult.remainingCredits });
  } catch (error) {
    log.error({ err: error }, "Listing enrich confirm error");
    return NextResponse.json({ error: "Error al regenerar el producto" }, { status: 500 });
  }
}
