import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ [Referidos] Intento de reclamación sin autenticación");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { rewardId } = await req.json();

    if (!rewardId) {
      console.log(`❌ [Referidos] Reward ID no proporcionado por usuario ${userId}`);
      return NextResponse.json({ error: "Reward ID requerido" }, { status: 400 });
    }

    console.log(`🎁 [Referidos] Usuario ${userId} reclamando recompensa: ${rewardId}`);

    const [reward] = await db
      .select()
      .from(schema.referralRewards)
      .where(eq(schema.referralRewards.id, rewardId))
      .limit(1);

    if (!reward) {
      console.log(`❌ [Referidos] Recompensa no encontrada: ${rewardId}`);
      return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
    }

    if (reward.userId !== userId) {
      console.log(`❌ [Referidos] Usuario ${userId} no es propietario de la recompensa ${rewardId}`);
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (reward.status !== "pending") {
      console.log(`❌ [Referidos] Recompensa ${rewardId} ya reclamada o expirada (estado: ${reward.status})`);
      return NextResponse.json({ error: "Recompensa no disponible" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .update(schema.referralRewards)
      .set({ status: "claimed", claimedAt: now })
      .where(eq(schema.referralRewards.id, rewardId));

    console.log(`✅ [Referidos] Recompensa ${rewardId} reclamada por ${userId}`);

    if (reward.type === "credit" && reward.amount) {
      await db
        .insert(schema.users)
        .values({ id: userId, credits: reward.amount })
        .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + ${reward.amount}` } });
      console.log(`💰 [Referidos] ${reward.amount} créditos añadidos a ${userId}`);
    } else if (reward.type === "free_month_pro" || reward.type === "free_month_enterprise") {
      // Extend subscription in a future iteration via Stripe API
      console.log(`🎁 [Referidos] Recompensa ${reward.type} registrada para ${userId} — activación pendiente`);
    }

    return NextResponse.json({ success: true, type: reward.type });
  } catch (error) {
    console.error("❌ [Referidos] Error al reclamar recompensa:", error);
    return NextResponse.json({ error: "Error al reclamar recompensa" }, { status: 500 });
  }
}
