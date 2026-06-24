import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const BADGE_MAP: Record<number, { type: string; name: string; icon: string }> = {
  1: { type: "first_referral", name: "Primer Referido", icon: "🌱" },
  5: { type: "5_referrals", name: "5 Referidos", icon: "⭐" },
  10: { type: "10_referrals", name: "10 Referidos", icon: "🏆" },
};

/**
 * Converts a referral and distributes rewards.
 * Called from the Stripe webhook (trusted path) or the /convert endpoint (user-facing).
 * Idempotent: returns false without throwing if already converted.
 */
export async function convertReferral(
  referralId: string,
  refereeUserId: string,
  plan: string
): Promise<boolean> {
  console.log(`💰 [Referidos] Convirtiendo referido ${referralId} para usuario ${refereeUserId}, plan: ${plan}`);

  try {
    // Fetch BEFORE updating so we have referrerId
    const [referral] = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.id, referralId))
      .limit(1);

    if (!referral) {
      console.log(`❌ [Referidos] Referido no encontrado: ${referralId}`);
      return false;
    }

    if (referral.status === "converted") {
      console.log(`⚠️ [Referidos] Referido ${referralId} ya estaba convertido`);
      return false;
    }

    const referrerId = referral.referrerId;
    const now = Math.floor(Date.now() / 1000);

    // Mark as converted
    await db
      .update(schema.referrals)
      .set({ status: "converted", convertedAt: now, refereeId: refereeUserId })
      .where(eq(schema.referrals.id, referralId));

    console.log(`✅ [Referidos] Referido ${referralId} marcado como convertido`);

    const rewardType = plan === "enterprise" ? "free_month_enterprise" : "free_month_pro";

    // Create reward for the referrer
    await db.insert(schema.referralRewards).values({
      id: uuidv4(),
      userId: referrerId,
      referralId,
      type: rewardType,
      amount: 1,
      status: "pending",
      createdAt: now,
    });

    console.log(`🎁 [Referidos] Recompensa asignada a referidor ${referrerId}: ${rewardType}`);

    // Give 10 credits to the referee (upsert — row may not exist yet)
    await db
      .insert(schema.users)
      .values({ id: refereeUserId, credits: 10 })
      .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + 10` } });

    console.log(`📊 [Referidos] Créditos asignados al referido ${refereeUserId}: +10`);

    // Increment referrer counters (upsert — row may not exist yet)
    await db
      .insert(schema.users)
      .values({ id: referrerId, convertedReferrals: 1, totalReferrals: 1 })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          convertedReferrals: sql`converted_referrals + 1`,
          totalReferrals: sql`total_referrals + 1`,
        },
      });

    console.log(`📊 [Referidos] Contadores actualizados para referidor ${referrerId}`);

    // Fetch updated count for badge milestone check
    const [referrer] = await db
      .select({ convertedReferrals: schema.users.convertedReferrals })
      .from(schema.users)
      .where(eq(schema.users.id, referrerId))
      .limit(1);

    const count = referrer?.convertedReferrals ?? 0;
    console.log(`🏅 [Referidos] Referidor ${referrerId} tiene ${count} referidos convertidos`);

    if (BADGE_MAP[count]) {
      const badge = BADGE_MAP[count];
      await db
        .insert(schema.badges)
        .values({
          id: uuidv4(),
          userId: referrerId,
          type: badge.type,
          name: badge.name,
          icon: badge.icon,
          earnedAt: now,
        })
        .onConflictDoNothing();
      console.log(`🏅 [Referidos] Insignia "${badge.name}" otorgada a ${referrerId}`);
    }

    console.log(`✅ [Referidos] Proceso de conversión completado para usuario ${refereeUserId}`);
    return true;
  } catch (error) {
    console.error("❌ [Referidos] Error en convertReferral:", error);
    return false;
  }
}
