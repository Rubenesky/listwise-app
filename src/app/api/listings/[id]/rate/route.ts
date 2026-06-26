import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // rating: 1 (thumbs up) | -1 (thumbs down) | null (clear)
    const rating = body.rating;
    if (rating !== 1 && rating !== -1 && rating !== null) {
      return NextResponse.json({ error: "Rating inválido. Usa 1, -1 o null." }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: schema.listings.id })
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Listing no encontrado" }, { status: 404 });
    }

    await db
      .update(schema.listings)
      .set({ userRating: rating })
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)));

    return NextResponse.json({ success: true, rating });
  } catch (error) {
    console.error("❌ [Rate] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
