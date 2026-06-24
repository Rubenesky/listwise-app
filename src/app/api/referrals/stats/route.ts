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

    console.log(`📊 [Referidos] Consultando estadísticas de usuario: ${userId}`);

    const allReferrals = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referrerId, userId));

    const converted = allReferrals.filter((r) => r.status === "converted").length;
    console.log(`📊 [Referidos] Estadísticas de ${userId}: total=${allReferrals.length}, convertidos=${converted}`);

    return NextResponse.json({
      total: allReferrals.length,
      pending: allReferrals.filter((r) => r.status === "pending").length,
      registered: allReferrals.filter((r) => r.status === "registered").length,
      converted,
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
