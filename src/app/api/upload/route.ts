import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import { PLAN_LIMITS } from "@/lib/constants";
import { ratelimit } from "@/lib/rate-limit";

async function sendTriggerEvent(userId: string, batchId: string) {
  const response = await fetch("https://api.trigger.dev/api/v1/tasks/process-batch/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
    },
    body: JSON.stringify({
      payload: {
        userId: userId,
        batchId: batchId,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error sending trigger event:", errorText);
    throw new Error("Failed to send trigger event");
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

    // 1. Obtener el plan del usuario
    const subscription = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    const userPlan = subscription.length > 0 ? subscription[0].plan : "free";
    const planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || 10;

    // 2. Contar productos actuales del usuario
    const totalProducts = await db
      .select({ count: count() })
      .from(schema.listings)
      .where(eq(schema.listings.userId, userId));

    const currentCount = totalProducts[0]?.count || 0;

    // 3. Parsear el CSV
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx 5MB)" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Solo se aceptan archivos CSV" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("utf-8");

    let records: any[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (error) {
      return NextResponse.json({ error: "Error al parsear el CSV" }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "El CSV está vacío" }, { status: 400 });
    }

    // 4. Verificar límite de productos
    const newProductsCount = records.length;
    const totalAfterUpload = currentCount + newProductsCount;

    if (totalAfterUpload > planLimit) {
      return NextResponse.json({
        error: `Has superado el límite de tu plan (${userPlan}). Límite: ${planLimit} productos. Actualmente tienes ${currentCount} y estás subiendo ${newProductsCount}.`,
        limit: planLimit,
        current: currentCount,
        attempting: newProductsCount,
        plan: userPlan,
      }, { status: 403 });
    }

    // 5. Validar que existe la columna productName
    if (!records[0].productName) {
      return NextResponse.json({
        error: 'El CSV debe tener una columna llamada "productName"'
      }, { status: 400 });
    }

    // 6. Insertar productos en la base de datos
    const listings = records.map((record) => ({
      id: uuidv4(),
      userId: userId,
      productName: record.productName || "",
      category: record.category || null,
      attributes: (() => {
        if (!record.attributes) return null;
        try { return JSON.parse(record.attributes); } catch { return null; }
      })(),
      status: "PENDING" as const,
      generatedTitle: null,
      generatedBullets: null,
      generatedDescription: null,
      errorMessage: null,
      createdAt: Math.floor(Date.now() / 1000),
    }));

    await db.insert(schema.listings).values(listings);

    // 7. Disparar el worker de Trigger.dev
    const batchId = uuidv4();
    await sendTriggerEvent(userId, batchId);

    return NextResponse.json({
      success: true,
      count: listings.length,
      batchId: batchId,
      plan: userPlan,
      remaining: planLimit - totalAfterUpload,
    });

  } catch (error) {
    console.error("Error en upload:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}
