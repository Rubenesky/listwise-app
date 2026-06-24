import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ratelimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const { slug, referrer, device } = await req.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
    }

    // Rate limit by IP + slug — prevents view inflation
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { success } = await ratelimit.limit(`view:${ip}:${slug}`);
    if (!success) {
      // Return 200 silently — bots shouldn't know they were blocked
      return NextResponse.json({ success: true });
    }

    const [listing] = await db
      .select({ id: schema.listings.id, userId: schema.listings.userId })
      .from(schema.listings)
      .where(eq(schema.listings.slug, slug))
      .limit(1);

    if (!listing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.pageViews).values({
      id: uuidv4(),
      listingId: listing.id,
      userId: listing.userId,
      visitorIp: ip,
      visitorUserAgent: req.headers.get("user-agent") ?? null,
      referrer: referrer ?? "direct",
      device: device ?? "desktop",
      createdAt: now,
    });

    // Atomic increment — avoids TOCTOU race condition under concurrent views
    await db
      .update(schema.listings)
      .set({ shareCount: sql`share_count + 1` })
      .where(eq(schema.listings.id, listing.id));

    console.log(`👁️ [Views] Visita registrada para slug: ${slug} desde ${ip} (${referrer ?? "direct"})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Views] Error:", error);
    return NextResponse.json({ error: "Error al registrar visita" }, { status: 500 });
  }
}
