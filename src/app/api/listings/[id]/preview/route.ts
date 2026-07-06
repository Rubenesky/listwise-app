import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { log } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) {
      log.warn({ userId, listingId: id }, "Preview: listing not found");
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      id: listing.id,
      productName: listing.productName,
      category: listing.category,
      attributes: listing.attributes,
      generatedTitle: listing.generatedTitle,
      generatedBullets: listing.generatedBullets as string[] | null,
      generatedDescription: listing.generatedDescription,
      selectedVariant: listing.selectedVariant ?? null,
      status: listing.status,
    });
  } catch (error) {
    log.error({ err: error }, "Preview listing error");
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
  }
}
