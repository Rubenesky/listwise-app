import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, desc, count } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [listings, [totalResult]] = await Promise.all([
      db
        .select({
          id: schema.listings.id,
          productName: schema.listings.productName,
          category: schema.listings.category,
          status: schema.listings.status,
          generatedTitle: schema.listings.generatedTitle,
          generatedTitleB: schema.listings.generatedTitleB,
          generatedBullets: schema.listings.generatedBullets,
          generatedDescription: schema.listings.generatedDescription,
          errorMessage: schema.listings.errorMessage,
          userRating: schema.listings.userRating,
          primaryKeyword: schema.listings.primaryKeyword,
          hookType: schema.listings.hookType,
          qualityFlags: schema.listings.qualityFlags,
        })
        .from(schema.listings)
        .where(eq(schema.listings.userId, userId))
        .orderBy(desc(schema.listings.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(schema.listings)
        .where(eq(schema.listings.userId, userId)),
    ]);

    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ [Dashboard] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
