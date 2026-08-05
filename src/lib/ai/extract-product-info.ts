import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

export interface ProductInfo {
  productName: string;
  category: string;
  attributes: Record<string, string>;
  primaryKeyword: string;
  confidence: number;
}

const MAX_INPUT_CHARS = 8000;

// Text-based counterpart to the old vision-based product analysis (the
// deleted PhotoUploader's VISION_PROMPT) — same output shape, but reads
// scraped/extracted text instead of an image. Unlike extractSpecsFromText
// (which merges into an EXISTING product's attributes), this extracts a
// full new product description from scratch, so there's no sensible
// "empty" fallback on failure — returns null, and the caller must show a
// clear "could not identify a product" error rather than silently
// proceeding with nothing.
export async function extractProductInfoFromText(text: string): Promise<ProductInfo | null> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const prompt =
    `Eres un experto en ecommerce. A partir de este texto extraído de una página web o un PDF de proveedor, ` +
    `identifica el producto principal descrito (ignora menús de navegación, productos relacionados, reseñas o publicidad — ` +
    `quédate solo con el producto principal de esta fuente). ` +
    `Si el texto es de una página de categoría o listado con varios productos distintos con nombre propio ` +
    `(por ejemplo varias líneas tipo "Mosquitera Enrollable Cajón 39mm TotQuality", "Mosquitera Antiviento Irina Premium"), ` +
    `usa como producto principal el PRIMER producto con nombre específico que aparezca en el texto — ` +
    `no inventes ni sintetices un producto genérico combinando varios. ` +
    `Devuelve SOLO un JSON válido con esta estructura exacta: ` +
    `{"productName": string (nombre descriptivo del producto en español, máx 100 chars), ` +
    `"category": string (una de: ropa, electrónica, hogar, deportes, alimentación, belleza, juguetes, mascotas, otro), ` +
    `"attributes": {clave: valor} (máximo 6 atributos clave como material, color, dimensiones, uso, etc., solo datos confirmados en el texto), ` +
    `"primaryKeyword": string (keyword principal para SEO, 2-4 palabras en español), ` +
    `"confidence": number (0-1, tu nivel de confianza en que identificaste correctamente el producto principal)}` +
    `\n\nTEXTO:\n${truncated}`;

  try {
    const response = await getAIResponse(
      [{ role: "user", content: prompt }],
      "groq",
      { temperature: 0.2, response_format: { type: "json_object" } }
    );
    const completion = response as { choices: { message: { content: string | null } }[] };
    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ProductInfo>;
    if (!parsed.productName || !parsed.category) return null;

    const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const confidence = Math.max(0, Math.min(1, rawConfidence));

    const attributes: Record<string, string> = {};
    if (parsed.attributes && typeof parsed.attributes === "object") {
      for (const [key, value] of Object.entries(parsed.attributes)) {
        if (Object.keys(attributes).length >= 20) break;
        if (typeof value === "string" && value.trim()) attributes[key] = value.trim().slice(0, 200);
      }
    }

    return {
      productName: parsed.productName.slice(0, 100),
      category: parsed.category,
      attributes,
      primaryKeyword: parsed.primaryKeyword ?? "",
      confidence,
    };
  } catch (error) {
    log.warn({ err: error }, "extractProductInfoFromText failed");
    return null;
  }
}
