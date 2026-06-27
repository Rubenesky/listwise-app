import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { trackGamification } from "@/lib/gamification/track";
import { ratelimitSave } from "@/lib/rate-limit";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const { success: saveOk } = await ratelimitSave.limit(`save:${userId}`);
    if (!saveOk) {
      return NextResponse.json({ error: "Demasiadas guardadas. Espera un momento." }, { status: 429 });
    }

    const body = await req.json();
    const { title, bullets, description, variantId, style } = body;

    console.log(`💾 [Save] Guardando descripción para producto ${id}`);
    if (variantId) console.log(`📝 [Save] Variante seleccionada: ${variantId} (${style})`);

    // Verify ownership before writing
    const [existing] = await db
      .select({ id: schema.listings.id })
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!existing) {
      console.log(`❌ [Save] Producto ${id} no encontrado`);
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Partial update — only touch fields that were explicitly sent in the request body
    const updateSet = {
      ...("title" in body ? { generatedTitle: title as string } : {}),
      ...("bullets" in body ? { generatedBullets: bullets as string[] } : {}),
      ...("description" in body ? { generatedDescription: description as string } : {}),
      ...("variantId" in body ? { selectedVariant: (variantId as string | null) ?? null } : {}),
    };

    if (Object.keys(updateSet).length === 0) {
      return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
    }

    await db
      .update(schema.listings)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateSet as any)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)));

    // Record variant selection for analytics when a specific variant was chosen
    if (variantId && style) {
      const variantIndex = parseInt(String(variantId).split("-")[1] ?? "0", 10);
      await db.insert(schema.variantSelections).values({
        id: uuidv4(),
        listingId: id,
        userId,
        variantIndex,
        style: String(style),
        selectedAt: Math.floor(Date.now() / 1000),
      });
      console.log(`📊 [Save] Selección registrada: variante ${variantIndex} (${style}) para producto ${id}`);
    }

    console.log(`✅ [Save] Descripción guardada para producto ${id}`);
    trackGamification(userId, "edit_description").catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Save] Error al guardar:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
