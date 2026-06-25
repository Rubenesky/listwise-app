import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { groq } from "@/lib/ai/client-groq";
import { buildUserPrompt } from "@/lib/ai/prompts";
import { ratelimit } from "@/lib/rate-limit";
import { z } from "zod";
import { trackGamification } from "@/lib/gamification/track";

const generatedContentSchema = z.object({
  title: z.string().max(80),
  bullets: z.array(z.string()).length(5),
  description: z.string(),
});

const requestSchema = z.object({
  count: z.number().min(1).max(5).default(3),
});

const STYLES = ["creativo", "profesional", "seo"] as const;
type Style = typeof STYLES[number];

const STYLE_PROMPTS: Record<Style, string> = {
  creativo: "Usa un tono emocional, aspiracional y con storytelling. Apela a los sentimientos y sueños del cliente.",
  profesional: "Usa un tono técnico, claro y profesional. Enfócate en especificaciones y funcionalidad.",
  seo: "Optimiza para SEO con palabras clave naturales y alta densidad. Incluye términos de búsqueda relevantes.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ [Variants] Intento sin autenticación");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Rate limiting — separate bucket per user for variants endpoint
    const { success, limit, reset, remaining } = await ratelimit.limit(`variants:${userId}`);
    if (!success) {
      console.log(`❌ [Variants] Rate limit excedido para usuario ${userId}`);
      return NextResponse.json(
        {
          error: "Has generado demasiadas variantes. Espera un momento.",
          limit,
          reset: new Date(reset).toISOString(),
          remaining,
        },
        { status: 429 }
      );
    }

    const { id } = await params;

    // Validate and sanitize count — only allow 1-5
    let count = 3;
    try {
      const body = await req.json();
      count = requestSchema.parse(body).count;
    } catch {
      // Use default count if body is invalid
    }

    console.log(`🎨 [Variants] Generando ${count} variantes para producto ${id}, usuario ${userId}`);

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) {
      console.log(`❌ [Variants] Producto ${id} no encontrado`);
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const variants = [];
    const variantCount = Math.min(count, STYLES.length);

    for (let i = 0; i < variantCount; i++) {
      const style = STYLES[i % STYLES.length];
      const stylePrompt = STYLE_PROMPTS[style];

      console.log(`🎨 [Variants] Generando variante ${i + 1}/${variantCount} (${style})`);

      try {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Eres un copywriter experto en e-commerce con 10 años de experiencia. Genera una descripción de producto con el siguiente estilo: ${stylePrompt}\n\nResponde EN ESTRICTAMENTE JSON con:\n{"title": "Título de máximo 80 caracteres","bullets": ["Beneficio 1","Beneficio 2","Beneficio 3","Beneficio 4","Beneficio 5"],"description": "Descripción de 150-200 palabras"}\n\nLos bullets deben empezar con verbos en presente. La descripción debe ser persuasiva y orientada a la conversión.`,
            },
            {
              role: "user",
              content: buildUserPrompt({
                productName: listing.productName,
                category: listing.category,
                attributes: listing.attributes as Record<string, string> | null,
              }),
            },
          ],
          temperature: 0.7 + i * 0.1,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        });

        const text = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text);
        const validated = generatedContentSchema.parse(parsed);

        variants.push({ id: `variant-${i + 1}`, style, ...validated });
        console.log(`✅ [Variants] Variante ${i + 1} (${style}) generada`);
      } catch (err) {
        console.error(`❌ [Variants] Error generando variante ${i + 1}:`, err);
        // Skip failed variant and continue
      }
    }

    if (variants.length === 0) {
      console.log(`❌ [Variants] No se generaron variantes para ${id}`);
      return NextResponse.json({ error: "No se pudieron generar variantes" }, { status: 500 });
    }

    console.log(`✅ [Variants] ${variants.length} variantes generadas para ${id}`);
    trackGamification(userId, "generate_product").catch(() => {});
    return NextResponse.json({ variants });
  } catch (error) {
    console.error("❌ [Variants] Error general:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al generar variantes" }, { status: 500 });
  }
}
