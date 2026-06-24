import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { convertReferral } from "@/lib/referrals/convert";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ [Referidos] Intento de conversión sin autenticación");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { referralId, plan } = await req.json();

    if (!referralId) {
      return NextResponse.json({ error: "referralId requerido" }, { status: 400 });
    }

    console.log(`💰 [Referidos] Conversión solicitada por usuario ${userId}`);

    // Fetch referral to run safety checks before delegating
    const [referral] = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.id, referralId))
      .limit(1);

    if (!referral) {
      console.log(`❌ [Referidos] Referido no encontrado: ${referralId}`);
      return NextResponse.json({ error: "Referido no encontrado" }, { status: 404 });
    }

    // Self-referral guard
    if (referral.referrerId === userId) {
      console.log(`❌ [Referidos] Auto-referido bloqueado para usuario ${userId}`);
      return NextResponse.json({ error: "No puedes convertir tu propio referido" }, { status: 400 });
    }

    if (referral.status === "converted") {
      console.log(`⚠️ [Referidos] Referido ${referralId} ya convertido`);
      return NextResponse.json({ error: "Este referido ya fue convertido" }, { status: 409 });
    }

    const ok = await convertReferral(referralId, userId, plan ?? "pro");

    if (!ok) {
      return NextResponse.json({ error: "Error al convertir referido" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Referidos] Error en conversión:", error);
    return NextResponse.json({ error: "Error al convertir referido" }, { status: 500 });
  }
}
