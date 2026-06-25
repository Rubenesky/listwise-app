import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const transactions = await db
      .select()
      .from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.userId, userId))
      .orderBy(desc(schema.creditTransactions.createdAt))
      .limit(50);

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("❌ [Credits History] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
