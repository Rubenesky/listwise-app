import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { groq } from "@/lib/ai/client-groq";
import { v4 as uuidv4 } from "uuid";

const requestSchema = z.object({
  examples: z
    .array(z.string().min(10).max(800))
    .min(3, "Se necesitan al menos 3 ejemplos")
    .max(10, "Máximo 10 ejemplos"),
  name: z.string().min(1).max(80).default("Mi perfil de voz"),
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

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Datos inválidos";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { examples, name } = parsed.data;

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

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let profileData: z.infer<typeof voiceProfileResponseSchema>;
    try {
      profileData = voiceProfileResponseSchema.parse(JSON.parse(rawContent));
    } catch {
      return NextResponse.json(
        { error: "La IA devolvió una respuesta en formato incorrecto. Inténtalo de nuevo." },
        { status: 500 }
      );
    }

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

    return NextResponse.json({ success: true, id, profile: profileData, name });
  } catch (error) {
    console.error("[voice-profile/analyze]", error);
    return NextResponse.json(
      { error: "Error al analizar el perfil de voz. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
