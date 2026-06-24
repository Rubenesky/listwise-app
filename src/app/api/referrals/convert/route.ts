import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { referralId, plan } = await req.json();
    if (!referralId) {
      return NextResponse.json({ error: "referralId requerido" }, { status: 400 });
    }

    console.log(`💰 [Referidos] Conversión detectada para usuario: ${userId}, plan: ${plan ?? "pro"}`);

    // Fetch first so we know who the referrer is
    const [referral] = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.id, referralId))
      .limit(1);

    if (!referral) {
      return NextResponse.json({ error: "Referido no encontrado" }, { status: 404 });
    }

    // Prevent self-referral
    if (referral.referrerId === userId) {
      return NextResponse.json({ error: "No puedes convertir tu propio referido" }, { status: 400 });
    }

    if (referral.status === "converted") {
      return NextResponse.json({ error: "Este referido ya fue convertido" }, { status: 409 });
    }

    const now = Math.floor(Date.now() / 1000);

    // Mark referral as converted
    await db
      .update(schema.referrals)
      .set({ status: "converted", convertedAt: now, refereeId: userId })
      .where(eq(schema.referrals.id, referralId));

    const rewardType = plan === "enterprise" ? "free_month_enterprise" : "free_month_pro";

    // Create reward for the referrer
    await db.insert(schema.referralRewards).values({
      id: uuidv4(),
      userId: referral.referrerId,
      referralId,
      type: rewardType,
      amount: 1,
      status: "pending",
      createdAt: now,
    });

    console.log(`🎁 [Referidos] Recompensa asignada a referidor ${referral.referrerId}: ${rewardType}`);

    // Give 10 credits to the referee (upsert in case no row exists yet)
    await db
      .insert(schema.users)
      .values({ id: userId, credits: 10 })
      .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + 10` } });

    console.log(`📊 [Referidos] Créditos asignados al referido ${userId}: +10`);

    // Increment referrer counters (upsert in case no row exists yet)
    await db
      .insert(schema.users)
      .values({ id: referral.referrerId, convertedReferrals: 1, totalReferrals: 1 })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          convertedReferrals: sql`converted_referrals + 1`,
          totalReferrals: sql`total_referrals + 1`,
        },
      });

    // Award badges based on updated converted count
    const [referrer] = await db
      .select({ convertedReferrals: schema.users.convertedReferrals })
      .from(schema.users)
      .where(eq(schema.users.id, referral.referrerId))
      .limit(1);

    const count = referrer?.convertedReferrals ?? 0;

    const badgeMap: Record<number, { type: string; name: string; icon: string }> = {
      1: { type: "first_referral", name: "Primer Referido", icon: "🌱" },
      5: { type: "5_referrals", name: "5 Referidos", icon: "⭐" },
      10: { type: "10_referrals", name: "10 Referidos", icon: "🏆" },
    };

    if (badgeMap[count]) {
      const badge = badgeMap[count];
      await db.insert(schema.badges).values({
        id: uuidv4(),
        userId: referral.referrerId,
        type: badge.type,
        name: badge.name,
        icon: badge.icon,
        earnedAt: now,
      }).onConflictDoNothing();
      console.log(`🏅 [Referidos] Insignia "${badge.name}" otorgada a ${referral.referrerId}`);
    }

    console.log(`✅ [Referidos] Proceso de conversión completado para usuario ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en conversión:", error);
    return NextResponse.json({ error: "Error al convertir referido" }, { status: 500 });
  }
}
