import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAIResponse, getDefaultProvider } from "@/lib/ai/providers";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { ratelimitVoiceProfile } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";
import { log } from "@/lib/logger";

const requestSchema = z.object({
  examples: z
    .array(z.string().min(10).max(800))
    .min(3, "Se necesitan al menos 3 ejemplos")
    .max(10, "Máximo 10 ejemplos"),
  name: z.string().min(1).max(80).default("Mi voz de marca"),
});

const voiceProfileResponseSchema = z.object({
  tone: z.string(),
  vocabulary: z.string(),
  sentenceStructure: z.string(),
  keyWords: z.array(z.string()).default([]),
  brandPersonality: z.string(),
  suggestions: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { success: withinLimit } = await ratelimitVoiceProfile.limit(userId);
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Límite diario de creación de voces de marca alcanzado. Inténtalo mañana." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Datos inválidos";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { examples, name } = parsed.data;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(userId, 1, "Crear voz de marca");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: "No tienes créditos suficientes para crear una voz de marca.", upsell: true },
        { status: 402 }
      );
    }

    const prompt = `Eres un analista de branding y copywriting experto.
Analiza estas descripciones de productos y extrae el perfil de voz de la marca.

Ejemplos:
${examples.map((e, i) => `${i + 1}. ${e}`).join("\n\n")}

Responde SOLO en JSON con este formato exacto:
{
  "tone": "uno de: formal, informal, witty, professional, emotional, technical",
  "vocabulary": "uno de: simple, sophisticated, technical, playful, balanced",
  "sentenceStructure": "uno de: short, medium, long, mixed",
  "keyWords": ["palabra1", "palabra2", "palabra3"],
  "brandPersonality": "descripción breve de la personalidad de la marca en 1-2 frases",
  "suggestions": ["sugerencia 1 para mejorar", "sugerencia 2"]
}`;

    let rawContent = "";
    try {
      const response = await getAIResponse(
        [{ role: "user", content: prompt }],
        getDefaultProvider(),
        { temperature: 0.3, max_tokens: 1500, response_format: { type: "json_object" } }
      );

      const completion = response as { choices: { message: { content: string | null } }[] };
      rawContent = completion.choices[0]?.message?.content ?? "{}";
      const profileData = voiceProfileResponseSchema.parse(JSON.parse(rawContent));

      // Deactivate all existing profiles for this user
      await db
        .update(schema.voiceProfiles)
        .set({ isActive: 0 })
        .where(eq(schema.voiceProfiles.userId, userId));

      const id = uuidv4();
      await db.insert(schema.voiceProfiles).values({
        id,
        userId,
        name,
        profile: profileData,
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000),
      });

      return NextResponse.json({
        success: true,
        id,
        profile: profileData,
        name,
        remainingCredits: creditResult.remainingCredits,
      });
    } catch (innerError) {
      // Credit was already charged above — refund it since the profile was
      // never created, matching the refund-on-failure convention used
      // everywhere else credits are pre-deducted (e.g. enrich/confirm/route.ts).
      await addCredits(userId, 1, "refund", "Reembolso por error al crear voz de marca").catch((e) =>
        log.warn({ err: e }, "Credit refund failed")
      );
      const isFormatError = innerError instanceof SyntaxError || innerError instanceof z.ZodError;
      if (isFormatError) {
        log.warn({ err: innerError, rawContent }, "voice-profile/analyze: AI response failed JSON parse/validation");
      }
      return NextResponse.json(
        {
          error: isFormatError
            ? "La IA devolvió una respuesta en formato incorrecto. Inténtalo de nuevo."
            : "Error al analizar la voz de marca. Inténtalo de nuevo.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error({ err: error }, "voice-profile/analyze error");
    return NextResponse.json(
      { error: "Error al analizar la voz de marca. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
