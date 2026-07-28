import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import { ratelimit } from "@/lib/rate-limit";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { trackGamification } from "@/lib/gamification/track";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { MODE_CONFIG, type GenerationMode } from "@/lib/ai/prompts";
import { inArray } from "drizzle-orm";
import { log } from "@/lib/logger";

import { validateRows } from "@/lib/csv/validate-rows";
import { buildEnrichedSourceRows } from "@/lib/csv/build-enriched-sources";

// ─── Trigger ──────────────────────────────────────────────────────────────────

async function sendTriggerEvent(userId: string, batchId: string, mode: string, provider = "groq", userEmail?: string) {
  const response = await fetch("https://api.trigger.dev/api/v1/tasks/process-batch/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
    },
    body: JSON.stringify({
      payload: {
        userId,
        batchId,
        mode,
        provider,
        userEmail,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ status: response.status, body: errorText }, "Trigger event failed");
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
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
    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;
    log.info({ userId }, "Upload started");

    const { success } = await ratelimit.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas peticiones. Espera un momento." },
        { status: 429 }
      );
    }

    // 1. Obtener plan del usuario
    const subscription = await db.select({ plan: schema.subscriptions.plan })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    const userPlan = subscription.length > 0 ? subscription[0].plan : "free";

    // 3. Parsear el CSV
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = (formData.get("mode") as string) || "creative";
    const provider = (formData.get("provider") as string) || "groq";
    const marketplace = (formData.get("marketplace") as string) || null;
    const priceSegment = (formData.get("priceSegment") as string) || null;

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

    let records: Record<string, string>[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      return NextResponse.json({ error: "Error al parsear el CSV" }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "El CSV está vacío" }, { status: 400 });
    }

    // 4. Validar filas (errores bloquean; warnings se incluyen en la respuesta)
    const { errors: rowErrors, warnings } = validateRows(records);
    if (rowErrors.length > 0) {
      return NextResponse.json(
        {
          error: `El CSV contiene ${rowErrors.length} error${rowErrors.length === 1 ? "" : "es"} que deben corregirse antes de subir`,
          validationErrors: rowErrors,
        },
        { status: 422 }
      );
    }

    // 5. Credit check: require 1 credit per product (2 for Ficha Técnica, longer generation)
    const newProductsCount = records.length;
    const creditsPerProduct = MODE_CONFIG[mode as GenerationMode]?.creditsPerProduct ?? 1;
    const creditsRequired = newProductsCount * creditsPerProduct;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(
      userId,
      creditsRequired,
      `Generación de ${newProductsCount} descripción${newProductsCount !== 1 ? "es" : ""}`
    );
    if (!creditResult.success) {
      return NextResponse.json({
        error: `No tienes suficientes créditos. Necesitas ${creditsRequired} crédito${creditsRequired !== 1 ? "s" : ""} para generar ${newProductsCount} descripción${newProductsCount !== 1 ? "es" : ""}, pero solo tienes ${creditResult.remainingCredits}. Reduce el número de productos o compra más créditos.`,
        creditsRequired,
        creditsAvailable: creditResult.remainingCredits,
        insufficientCredits: true,
      }, { status: 402 });
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
      marketplace: marketplace,
      priceSegment: priceSegment,
      status: "PENDING" as const,
      generatedTitle: null,
      generatedBullets: null,
      generatedDescription: null,
      errorMessage: null,
      createdAt: Math.floor(Date.now() / 1000),
    }));

    log.info({ userId, count: listings.length }, "Listings inserted");
    await db.insert(schema.listings).values(listings);

    // 6b. Fuentes enriquecidas (columna sourceUrl opcional) — validación SSRF
    // ahora; el fetch + extracción real ocurre en process-products.ts.
    const { rows: enrichedRows, warnings: enrichedWarnings } = await buildEnrichedSourceRows(
      records,
      listings.map((l) => l.id),
      userId,
      async () => (await ratelimitEnrichedInput.limit(userId)).success
    );
    if (enrichedRows.length > 0) {
      await db.insert(schema.enrichedSources).values(enrichedRows);
      log.info({ userId, count: enrichedRows.length }, "Enriched sources queued");
    }
    warnings.push(...enrichedWarnings);

    // 7. Disparar el worker de Trigger.dev
    const batchId = uuidv4();
    const insertedIds = listings.map((l) => l.id);
    log.info({ userId, batchId }, "Batch triggered");
    try {
      await sendTriggerEvent(userId, batchId, mode, provider, userEmail);
    } catch (triggerError) {
      // Revert credits and mark the just-inserted listings as FAILED
      await addCredits(userId, creditsRequired, "refund", "Reembolso por error de procesamiento");
      if (insertedIds.length > 0) {
        await db.update(schema.listings)
          .set({ status: "FAILED", errorMessage: "Error al iniciar procesamiento. Puedes reintentar desde el dashboard." })
          .where(inArray(schema.listings.id, insertedIds));
      }
      throw triggerError;
    }

    trackGamification(userId, "upload_csv").catch((e) => log.warn({ err: e }, "trackGamification failed"));
    return NextResponse.json({
      success: true,
      count: listings.length,
      batchId: batchId,
      plan: userPlan,
      remainingCredits: creditResult.remainingCredits,
      ...(warnings.length > 0 && { warnings }),
    });

  } catch (error) {
    log.error({ err: error }, "Upload error");
    const msg = error instanceof Error ? error.message : "";
    if (msg === "RATE_LIMIT") {
      return NextResponse.json(
        { error: "Has superado el límite de solicitudes. Espera unos minutos e inténtalo de nuevo." },
        { status: 429 }
      );
    }
    if (msg === "TRIGGER_FAILED") {
      return NextResponse.json(
        { error: "No se pudo iniciar el procesamiento. Inténtalo de nuevo en unos segundos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar el archivo. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
