import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { ratelimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

const VISION_PROMPT =
  'Eres un experto en ecommerce. Analiza la imagen de este producto y devuelve SOLO un JSON válido con esta estructura exacta: { "productName": string (nombre descriptivo del producto en español, máx 100 chars), "category": string (una de: ropa, electrónica, hogar, deportes, alimentación, belleza, juguetes, mascotas, otro), "attributes": { key: string value: string } (máximo 6 atributos clave como material, color, dimensiones, uso, etc.), "primaryKeyword": string (keyword principal para SEO, 2-4 palabras en español), "confidence": number (0-1, tu nivel de confianza en el análisis) }';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { success } = await ratelimit.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no soportado. Usa JPG, PNG o WebP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande (máx 5MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp";

    let rawText: string;
    try {
      const message = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: VISION_PROMPT },
            ],
          },
        ],
      });

      const block = message.content[0];
      if (block.type !== "text") {
        throw new Error("Unexpected response type from vision API");
      }
      rawText = block.text;
    } catch {
      return NextResponse.json(
        { error: "No se pudo analizar la imagen. Inténtalo de nuevo." },
        { status: 500 }
      );
    }

    let analysis: {
      productName: string;
      category: string;
      attributes: Record<string, string>;
      primaryKeyword: string;
      confidence: number;
    };

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "La respuesta del análisis no pudo interpretarse. Inténtalo de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("[upload/photo] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
