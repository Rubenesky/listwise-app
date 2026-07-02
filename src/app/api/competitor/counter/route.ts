import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getAIResponse } from "@/lib/ai/providers";
import { useCredits } from "@/lib/credits/use-credits";

const bodySchema = z.object({
  listingId: z.string().min(1),
  competitorId: z.string().min(1),
});

interface CounterPositioningResult {
  competitorWeaknesses: string[];
  counterBullets: string[];
  counterTitle: string;
  summary: string;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { listingId, competitorId } = parsed.data;

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, listingId), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) {
      return NextResponse.json({ error: "Listing no encontrado" }, { status: 404 });
    }

    const [competitor] = await db
      .select()
      .from(schema.competitorAnalyses)
      .where(
        and(
          eq(schema.competitorAnalyses.id, competitorId),
          eq(schema.competitorAnalyses.userId, userId),
          eq(schema.competitorAnalyses.status, "COMPLETED")
        )
      )
      .limit(1);

    if (!competitor) {
      return NextResponse.json({ error: "Análisis de competidor no encontrado o no completado" }, { status: 404 });
    }

    const creditResult = await useCredits(userId, 2, "Análisis de contra-posicionamiento");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "No tienes suficientes créditos. Necesitas 2 créditos para este análisis." },
        { status: 402 }
      );
    }

    const prompt = `Eres un experto en copywriting de ecommerce y análisis competitivo.

PRODUCTO DEL USUARIO:
Nombre: ${listing.productName}
Categoría: ${listing.category ?? "Sin categoría"}
Atributos: ${JSON.stringify(listing.attributes)}
Descripción actual: ${listing.generatedDescription ?? "Sin descripción aún"}

LISTING DEL COMPETIDOR (scraped):
Título: ${competitor.scrapedTitle ?? "Sin título"}
Descripción: ${(competitor as Record<string, unknown>).scrapedDescription ?? "Sin descripción"}
Keywords detectadas: ${competitor.scrapedKeywords ?? "Sin keywords"}

TAREA:
1. Identifica 3-5 debilidades o ausencias en el listing del competidor (qué NO menciona, qué promete vagamente, qué objeciones deja sin responder).
2. Para cada debilidad, genera UN bullet point para el producto del usuario que llene ese gap de forma directa y específica.
3. Genera también un título alternativo para el producto del usuario que se posicione mejor que el competidor.

Devuelve SOLO JSON válido:
{
  "competitorWeaknesses": string[],
  "counterBullets": string[],
  "counterTitle": string,
  "summary": string
}`;

    const aiResponse = await getAIResponse(
      [{ role: "user", content: prompt }],
      undefined,
      { temperature: 0.7, max_tokens: 1500, response_format: { type: "json_object" } }
    );

    const content = aiResponse.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Error al generar el análisis" }, { status: 500 });
    }

    let result: CounterPositioningResult;
    try {
      result = JSON.parse(content) as CounterPositioningResult;
    } catch {
      return NextResponse.json({ error: "Error al procesar la respuesta de IA" }, { status: 500 });
    }

    if (
      !Array.isArray(result.competitorWeaknesses) ||
      !Array.isArray(result.counterBullets) ||
      typeof result.counterTitle !== "string" ||
      typeof result.summary !== "string"
    ) {
      return NextResponse.json({ error: "Respuesta de IA con formato inválido" }, { status: 500 });
    }

    return NextResponse.json({
      competitorWeaknesses: result.competitorWeaknesses,
      counterBullets: result.counterBullets.slice(0, 5),
      counterTitle: result.counterTitle,
      summary: result.summary,
      remainingCredits: creditResult.remainingCredits,
    });
  } catch (error) {
    console.error("❌ [Counter] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
