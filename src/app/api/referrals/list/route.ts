import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const referrals = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referrerId, userId))
      .orderBy(desc(schema.referrals.createdAt));

    return NextResponse.json({ referrals });
  } catch {
    return NextResponse.json({ error: "Error al listar referidos" }, { status: 500 });
  }
}
