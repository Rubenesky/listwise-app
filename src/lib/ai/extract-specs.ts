import { getAIResponse } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

const MAX_INPUT_CHARS = 8000;

// Deliberately a cheap, separate call (Groq's small model) that reduces raw
// source text to confirmed key-value specs — the raw text itself never
// reaches the main generation prompt (see design spec, decision #2).
export async function extractSpecsFromText(
  rawText: string,
  productName: string,
  translateToSpanish: boolean
): Promise<Record<string, string>> {
  const truncated = rawText.slice(0, MAX_INPUT_CHARS);
  const translateInstruction = translateToSpanish
    ? " El texto puede estar en otro idioma — traduce los valores extraídos al español."
    : "";
  const prompt =
    `Extrae únicamente especificaciones técnicas CONFIRMADAS de este texto sobre "${productName}".` +
    `${translateInstruction} Devuelve SOLO un JSON plano de clave-valor ` +
    `(ej: {"material": "aluminio", "medidas": "120x80cm"}). No inventes datos que no estén en el texto. ` +
    `Si no hay especificaciones claras, devuelve {}.\n\nTEXTO:\n${truncated}`;

  try {
    const response = await getAIResponse(
      [{ role: "user", content: prompt }],
      "groq",
      { temperature: 0.1, response_format: { type: "json_object" } }
    );
    const completion = response as { choices: { message: { content: string | null } }[] };
    const text = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
    }
    return result;
  } catch (error) {
    log.warn({ err: error }, "extractSpecsFromText failed — returning empty specs");
    return {};
  }
}
