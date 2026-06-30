import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const discounts = await db
      .select({
        id: schema.gamificationDiscounts.id,
        type: schema.gamificationDiscounts.type,
        code: schema.gamificationDiscounts.code,
        used: schema.gamificationDiscounts.used,
        expiresAt: schema.gamificationDiscounts.expiresAt,
      })
      .from(schema.gamificationDiscounts)
      .where(eq(schema.gamificationDiscounts.userId, userId));

    return NextResponse.json({ discounts });
  } catch (error) {
    console.error("❌ [Gamification Discounts] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
