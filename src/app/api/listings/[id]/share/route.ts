import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { trackGamification } from "@/lib/gamification/track";

function generateSlug(productName: string): string {
  const base = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = uuidv4().slice(0, 8);
  return `${base}-${suffix}`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    console.log(`🔗 [Share] Generando landing page para producto ${id}`);

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) {
      console.log(`❌ [Share] Producto ${id} no encontrado`);
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (listing.status !== "COMPLETED") {
      return NextResponse.json({ error: "El producto aún no tiene contenido generado" }, { status: 400 });
    }

    let slug = listing.slug;
    if (!slug) {
      slug = generateSlug(listing.productName);
      await db.update(schema.listings).set({ slug }).where(eq(schema.listings.id, id));
      console.log(`✅ [Share] Slug generado: ${slug}`);
    } else {
      console.log(`✅ [Share] Slug existente reutilizado: ${slug}`);
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${slug}`;

    console.log(`✅ [Share] URL generada: ${shareUrl}`);
    trackGamification(userId, "share_landing").catch(() => {});
    return NextResponse.json({ url: shareUrl, slug });
  } catch (error) {
    console.error("❌ [Share] Error:", error);
    return NextResponse.json({ error: "Error al generar URL" }, { status: 500 });
  }
}
