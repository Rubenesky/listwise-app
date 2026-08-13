import { getAIResponse, getDefaultProvider } from "@/lib/ai/providers";

// Feeding a raw listing (title + bullets + description, joined by periods)
// straight into TTS reads like "an AI reading a spec sheet" — confirmed by
// a real audio-quality review (ChatGPT, listening to a generated sample).
// The fix isn't audio processing, it's giving the TTS model a proper spoken
// script instead of the raw listing data.
const SCRIPT_PROMPT = `Eres un vendedor profesional que presenta productos por nota de voz de WhatsApp a un posible comprador.

Transforma esta ficha de producto en un guion hablado natural y persuasivo, en español de España, pensado para ser leído por una voz sintética — NO leas el título ni los bullets tal cual, reformúlalo como si se lo explicaras a un amigo.

FICHA DEL PRODUCTO:
Título: {title}
Características:
{bullets}
Descripción: {description}

REGLAS:
- Empieza con un gancho que responda a "¿por qué me debería interesar esto?" ANTES de nombrar o describir el producto — no arranques con "Esta [producto]...", arranca con el beneficio o la necesidad que resuelve (ej: "Si buscas algo cómodo y fácil de combinar, esto puede ser justo lo que buscas.").
- Estructura completa: gancho/beneficio → qué es → características principales → cierre.
- Frases fluidas que unan ideas relacionadas — nada de frases telegráficas cortadas por puntos.
- Menciona las características importantes de los bullets de forma natural, sin listarlas.
- Escribe medidas y unidades de forma fonéticamente amigable (ej: "200 g/m²" → "doscientos gramos por metro cuadrado").
- Cierra con una frase que deje una impresión positiva, sin sonar a anuncio agresivo.
- Longitud objetivo: 80-120 palabras (unos 35-50 segundos hablados) — es el punto óptimo confirmado para nota de voz de WhatsApp: ni tan corto que se quede en identificar el producto, ni tan largo que se sienta a formato catálogo.
- No inventes datos que no estén en la ficha.

Responde SOLO con el guion, sin comillas ni explicaciones ni encabezados.`;

export async function generateSpokenScript(params: {
  title: string;
  bullets: string[];
  description: string;
}): Promise<string> {
  const prompt = SCRIPT_PROMPT.replace("{title}", params.title)
    .replace("{bullets}", params.bullets.map((b) => `- ${b}`).join("\n"))
    .replace("{description}", params.description);

  const response = await getAIResponse(
    [{ role: "user", content: prompt }],
    getDefaultProvider(),
    { temperature: 0.6, max_tokens: 400 }
  );

  const completion = response as { choices: { message: { content: string | null } }[] };
  const script = completion.choices[0]?.message?.content?.trim();
  if (!script) throw new Error("No se pudo generar el guion del audio");
  return script;
}
