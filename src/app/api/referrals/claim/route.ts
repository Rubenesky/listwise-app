import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";

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

    // Fetch first to check ownership before any mutation
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

    const now = Math.floor(Date.now() / 1000);

    // Atomic conditional UPDATE — only claims if still "pending".
    // Prevents TOCTOU double-claim race condition.
    const updated = await db
      .update(schema.referralRewards)
      .set({ status: "claimed", claimedAt: now })
      .where(and(eq(schema.referralRewards.id, rewardId), eq(schema.referralRewards.status, "pending")))
      .returning({ id: schema.referralRewards.id, type: schema.referralRewards.type, amount: schema.referralRewards.amount });

    if (updated.length === 0) {
      console.log(`❌ [Referidos] Recompensa ${rewardId} ya reclamada (race condition evitada)`);
      return NextResponse.json({ error: "Recompensa no disponible" }, { status: 409 });
    }

    const claimed = updated[0];
    console.log(`✅ [Referidos] Recompensa ${rewardId} reclamada por ${userId}`);

    if (claimed.type === "credit" && claimed.amount) {
      await db
        .insert(schema.users)
        .values({ id: userId, credits: claimed.amount })
        .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + ${claimed.amount}` } });
      console.log(`💰 [Referidos] ${claimed.amount} créditos añadidos a ${userId}`);
    } else if (claimed.type === "free_month_pro" || claimed.type === "free_month_enterprise") {
      // Extend subscription in a future iteration via Stripe API
      console.log(`🎁 [Referidos] Recompensa ${claimed.type} registrada para ${userId} — activación pendiente`);
    }

    return NextResponse.json({ success: true, type: claimed.type });
  } catch (error) {
    console.error("❌ [Referidos] Error al reclamar recompensa:", error);
    return NextResponse.json({ error: "Error al reclamar recompensa" }, { status: 500 });
  }
}
