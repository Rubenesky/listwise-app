import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ratelimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string(),
  attributes: z.record(z.string()).optional(),
  primaryKeyword: z.string().optional(),
  marketplace: z.string().optional(),
});

async function sendTriggerEvent(userId: string, batchId: string) {
  const response = await fetch(
    "https://api.trigger.dev/api/v1/tasks/process-batch/trigger",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
      },
      body: JSON.stringify({
        payload: {
          userId,
          batchId,
          mode: "creative",
          provider: "groq",
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("[listings/from-photo] Trigger error:", response.status, text);
    throw new Error("TRIGGER_FAILED");
  }

  return response.json();
}

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

    let body: z.infer<typeof bodySchema>;
    try {
      const raw = await req.json();
      body = bodySchema.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Datos de entrada no válidos." },
        { status: 400 }
      );
    }

    const listingId = uuidv4();
    const batchId = uuidv4();

    await db.insert(schema.listings).values({
      id: listingId,
      userId,
      productName: body.productName,
      category: body.category ?? null,
      attributes: body.attributes ?? null,
      marketplace: body.marketplace ?? null,
      primaryKeyword: body.primaryKeyword ?? null,
      status: "PENDING",
      generatedTitle: null,
      generatedBullets: null,
      generatedDescription: null,
      errorMessage: null,
      createdAt: Math.floor(Date.now() / 1000),
    });

    try {
      await sendTriggerEvent(userId, batchId);
    } catch (triggerErr) {
      console.error("[listings/from-photo] Trigger failed:", triggerErr);
      await db
        .update(schema.listings)
        .set({
          status: "FAILED",
          errorMessage:
            "Error al iniciar procesamiento. Puedes reintentar desde el dashboard.",
        })
        .where(eq(schema.listings.id, listingId));

      return NextResponse.json(
        {
          error:
            "No se pudo iniciar el procesamiento. Inténtalo de nuevo en unos segundos.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, listingId });
  } catch (error) {
    console.error("[listings/from-photo] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
