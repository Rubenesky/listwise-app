import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const rewards = await db
      .select()
      .from(schema.referralRewards)
      .where(eq(schema.referralRewards.userId, userId))
      .orderBy(desc(schema.referralRewards.createdAt));

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("❌ [Referidos] Error listando recompensas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
