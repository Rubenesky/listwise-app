import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { MODE_CONFIG, type GenerationMode } from "@/lib/ai/prompts";
import { sendTriggerEvent } from "@/lib/trigger/send-batch-event";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  productName: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  attributes: z
    .record(z.string())
    .optional()
    .refine(
      (attrs) =>
        !attrs ||
        (Object.keys(attrs).length <= 20 &&
          Object.values(attrs).every((value) => value.length <= 200)),
      { message: "attributes debe tener máximo 20 claves y valores de máximo 200 caracteres" }
    ),
  primaryKeyword: z.string().optional(),
  mode: z.string(),
  marketplace: z
    .union([z.enum(["amazon", "etsy", "shopify", "prestashop", "general"]), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  priceSegment: z
    .union([z.enum(["economy", "mid", "premium"]), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de entrada no válidos" }, { status: 400 });
    }
    const body = parsed.data;
    const mode = (body.mode && body.mode in MODE_CONFIG ? body.mode : "creative") as GenerationMode;
    const creditsRequired = MODE_CONFIG[mode]?.creditsPerProduct ?? 1;

    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(userId, creditsRequired, "Creación de producto desde URL/PDF");
    if (!creditResult.success) {
      return NextResponse.json(
        { error: `No tienes suficientes créditos. Necesitas ${creditsRequired}.` },
        { status: 402 }
      );
    }

    const listingId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.listings).values({
      id: listingId,
      userId,
      productName: body.productName,
      category: body.category,
      attributes: body.attributes ?? null,
      marketplace: body.marketplace ?? null,
      priceSegment: body.priceSegment ?? null,
      primaryKeyword: body.primaryKeyword ?? null,
      status: "PENDING",
      generatedTitle: null,
      generatedBullets: null,
      generatedDescription: null,
      errorMessage: null,
      createdAt: now,
    });

    const batchId = uuidv4();
    try {
      await sendTriggerEvent(userId, batchId, mode, "groq", userEmail);
    } catch (triggerError) {
      await addCredits(userId, creditsRequired, "refund", "Reembolso por error al crear producto desde URL/PDF");
      await db
        .update(schema.listings)
        .set({ status: "FAILED", errorMessage: "Error al iniciar procesamiento. Puedes reintentar." })
        .where(eq(schema.listings.id, listingId));
      log.error({ err: triggerError, userId, listingId }, "create-from-source: trigger dispatch failed");
      return NextResponse.json(
        { error: "No se pudo iniciar el procesamiento. Inténtalo de nuevo en unos segundos." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, listingId, remainingCredits: creditResult.remainingCredits });
  } catch (error) {
    log.error({ err: error }, "create-from-source: unhandled error");
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
