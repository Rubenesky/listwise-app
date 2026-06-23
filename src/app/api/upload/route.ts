import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import { PLAN_LIMITS } from "@/lib/constants";
import { ratelimit } from "@/lib/rate-limit";

// ─── Validation ───────────────────────────────────────────────────────────────

const SUPPORTED_CATEGORIES = new Set([
  "ropa", "moda", "calzado", "accesorios", "complementos",
  "electrónica", "electronica", "tecnología", "tecnologia",
  "informática", "informatica", "teléfonos", "telefonos", "tablets",
  "hogar", "cocina", "decoración", "decoracion", "muebles",
  "iluminación", "iluminacion", "jardín", "jardin", "baño", "bano",
  "deportes", "fitness", "outdoor", "ciclismo", "natación", "natacion",
  "alimentación", "alimentacion", "bebidas", "gourmet", "dietética",
  "dietetica", "suplementos",
  "cosmética", "cosmetica", "belleza", "perfumes", "salud",
  "bienestar", "farmacia",
  "juguetes", "bebés", "bebes", "niños", "ninos", "juegos",
  "libros", "librería", "libreria", "arte", "música", "musica",
  "películas", "peliculas", "series",
  "mascotas", "animales",
  "automoción", "automocion", "automóvil", "automovil", "motos",
  "bicicletas",
  "viajes", "turismo",
  "oficina", "papelería", "papeleria", "escuela",
  "joyería", "joyeria", "bisutería", "bisuteria", "relojes",
  "fotografía", "fotografia", "cámaras", "camaras",
  "videojuegos", "gaming", "consolas",
]);

const PRICE_RE = /^[€$£¥]?\s*\d{1,10}([.,]\d{1,3})*([.,]\d{1,2})?\s*[€$£¥]?$/;

function isValidPrice(raw: string): boolean {
  return PRICE_RE.test(raw.trim());
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function validateRows(records: Record<string, string>[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const MAX_ERRORS = 20;

  if (records.length === 0) return { errors, warnings };

  const headers = Object.keys(records[0]);

  if (!headers.includes("productName")) {
    errors.push('El CSV debe incluir la columna "productName"');
    return { errors, warnings };
  }

  const hasPrice = headers.includes("price");
  const hasCategory = headers.includes("category");

  for (let i = 0; i < records.length && errors.length < MAX_ERRORS; i++) {
    const row = i + 2; // row 1 = header, data starts at row 2
    const record = records[i];

    // productName: required, max 500 chars
    const name = record.productName?.trim() ?? "";
    if (!name) {
      errors.push(`Fila ${row}: el nombre del producto es obligatorio`);
    } else if (name.length > 500) {
      errors.push(
        `Fila ${row}: el nombre del producto es demasiado largo ` +
        `(${name.length} caracteres, máximo 500)`
      );
    }

    // price: valid numeric format if column exists and value is non-empty
    if (hasPrice && record.price?.trim()) {
      if (!isValidPrice(record.price)) {
        errors.push(
          `Fila ${row}: formato de precio no válido — "${record.price}" ` +
          `(usa formato numérico como "29.99" o "29,99€")`
        );
      }
    }

    // category: warn if unrecognized (non-blocking — AI handles any category)
    if (hasCategory && record.category?.trim()) {
      const normalized = record.category.trim().toLowerCase();
      if (!SUPPORTED_CATEGORIES.has(normalized)) {
        warnings.push(
          `Fila ${row}: categoría "${record.category}" no está en la lista de ` +
          `categorías conocidas — se procesará igualmente`
        );
      }
    }

    // attributes: warn if malformed JSON (non-blocking — we ignore it silently)
    if (record.attributes?.trim()) {
      try {
        JSON.parse(record.attributes);
      } catch {
        warnings.push(
          `Fila ${row}: los atributos no son JSON válido — se ignorarán durante el procesamiento`
        );
      }
    }
  }

  if (errors.length >= MAX_ERRORS) {
    errors.push(`... y más errores. Corrige los primeros ${MAX_ERRORS} y vuelve a subir.`);
  }

  return { errors, warnings };
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

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
    console.log(`📤 [Upload] Usuario ${userId} subiendo archivo`);

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

    // 4. Validar filas (errores bloquean; warnings se incluyen en la respuesta)
    const { errors: rowErrors, warnings } = validateRows(
      records as Record<string, string>[]
    );
    if (rowErrors.length > 0) {
      return NextResponse.json(
        {
          error: `El CSV contiene ${rowErrors.length} error${rowErrors.length === 1 ? "" : "es"} que deben corregirse antes de subir`,
          validationErrors: rowErrors,
        },
        { status: 422 }
      );
    }

    // 5. Verificar límite de productos
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

    console.log(`📤 [Upload] Productos: ${listings.length}`);
    await db.insert(schema.listings).values(listings);

    // 7. Disparar el worker de Trigger.dev
    const batchId = uuidv4();
    console.log(`📤 [Upload] Batch ID: ${batchId}`);
    await sendTriggerEvent(userId, batchId);

    return NextResponse.json({
      success: true,
      count: listings.length,
      batchId: batchId,
      plan: userPlan,
      remaining: planLimit === Infinity ? null : planLimit - totalAfterUpload,
      ...(warnings.length > 0 && { warnings }),
    });

  } catch (error) {
    console.error("Error en upload:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}
