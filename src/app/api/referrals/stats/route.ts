import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const allReferrals = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referrerId, userId));

    return NextResponse.json({
      total: allReferrals.length,
      pending: allReferrals.filter((r) => r.status === "pending").length,
      registered: allReferrals.filter((r) => r.status === "registered").length,
      converted: allReferrals.filter((r) => r.status === "converted").length,
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
