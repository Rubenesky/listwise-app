import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    console.log(`🔍 [Referidos] Validando código: ${code}`);

    const [referral] = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.code, code))
      .limit(1);

    if (!referral) {
      console.log(`❌ [Referidos] Código inválido: ${code}`);
      return NextResponse.json({ valid: false, error: "Código inválido" });
    }

    if (referral.status !== "pending") {
      console.log(`⚠️ [Referidos] Código ya utilizado: ${code} (estado: ${referral.status})`);
      return NextResponse.json({ valid: false, error: "Código ya utilizado" });
    }

    console.log(`✅ [Referidos] Código válido: ${code} - Referidor: ${referral.referrerId}`);
    return NextResponse.json({ valid: true, referrerId: referral.referrerId });
  } catch {
    return NextResponse.json({ error: "Error al validar código" }, { status: 500 });
  }
}
