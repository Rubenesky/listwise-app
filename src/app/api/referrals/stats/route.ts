import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

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

    const converted = allReferrals.filter((r) => r.status === "converted").length;

    return NextResponse.json({
      total: allReferrals.length,
      pending: allReferrals.filter((r) => r.status === "pending").length,
      registered: allReferrals.filter((r) => r.status === "registered").length,
      converted,
    });
  } catch (err) {
    log.error({ err }, "Referral stats error");
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
