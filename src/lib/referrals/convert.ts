import { db, schema } from "@/db";
import { and, eq, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { trackGamification } from "@/lib/gamification/track";

// Conversion badges — separate from registration badges (first_referral etc.)
const BADGE_MAP: Record<number, { type: string; name: string; icon: string }> = {
  1: { type: "first_conversion", name: "Primer Convertido", icon: "🌟" },
  5: { type: "5_conversions", name: "5 Convertidos", icon: "💫" },
  10: { type: "10_conversions", name: "10 Convertidos", icon: "👑" },
};

export async function convertReferral(
  referralId: string,
  refereeUserId: string,
  plan: string
): Promise<boolean> {
  console.log(`💰 [Referidos] Convirtiendo referido ${referralId} para usuario ${refereeUserId}, plan: ${plan}`);

  try {
    // Fetch BEFORE updating so we have referrerId and can run guards
    const [referral] = await db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.id, referralId))
      .limit(1);

    if (!referral) {
      console.log(`❌ [Referidos] Referido no encontrado: ${referralId}`);
      return false;
    }

    // Self-referral guard — defense-in-depth; callers should also enforce this
    if (referral.referrerId === refereeUserId) {
      console.log(`❌ [Referidos] Auto-referido bloqueado: referrerId === refereeUserId (${refereeUserId})`);
      return false;
    }

    const referrerId = referral.referrerId;
    const now = Math.floor(Date.now() / 1000);

    // Atomic conditional UPDATE — only converts if still "pending".
    // If two webhook deliveries race, only one will see updated.length > 0.
    const updated = await db
      .update(schema.referrals)
      .set({ status: "converted", convertedAt: now, refereeId: refereeUserId })
      .where(and(eq(schema.referrals.id, referralId), or(eq(schema.referrals.status, "pending"), eq(schema.referrals.status, "registered"))))
      .returning({ id: schema.referrals.id });

    if (updated.length === 0) {
      console.log(`⚠️ [Referidos] Referido ${referralId} ya fue convertido (race condition evitada)`);
      return false;
    }

    console.log(`✅ [Referidos] Referido ${referralId} marcado como convertido`);

    const rewardType = plan === "enterprise" ? "free_month_enterprise" : "free_month_pro";

    let convertedCount = 0;

    await db.transaction(async (tx) => {
      await tx.insert(schema.referralRewards).values({
        id: uuidv4(),
        userId: referrerId,
        referralId,
        type: rewardType,
        amount: 1,
        status: "pending",
        createdAt: now,
      });

      // Give 10 credits to the referee (upsert — row may not exist yet)
      await tx
        .insert(schema.users)
        .values({ id: refereeUserId, credits: 10 })
        .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + 10` } });

      // Increment referrer counters (upsert — row may not exist yet)
      await tx
        .insert(schema.users)
        .values({ id: referrerId, convertedReferrals: 1, totalReferrals: 1 })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            convertedReferrals: sql`converted_referrals + 1`,
            totalReferrals: sql`total_referrals + 1`,
          },
        });

      const [referrer] = await tx
        .select({ convertedReferrals: schema.users.convertedReferrals })
        .from(schema.users)
        .where(eq(schema.users.id, referrerId))
        .limit(1);

      convertedCount = referrer?.convertedReferrals ?? 0;

      // Check ALL milestones crossed — awards retroactively if a previous milestone was missed
      const earnedBadges = await tx
        .select({ type: schema.badges.type })
        .from(schema.badges)
        .where(eq(schema.badges.userId, referrerId));

      const earnedTypes = new Set(earnedBadges.map((b) => b.type));

      for (const [milestoneStr, badge] of Object.entries(BADGE_MAP)) {
        const milestone = parseInt(milestoneStr);
        if (convertedCount >= milestone && !earnedTypes.has(badge.type)) {
          await tx
            .insert(schema.badges)
            .values({ id: uuidv4(), userId: referrerId, type: badge.type, name: badge.name, icon: badge.icon, earnedAt: now })
            .onConflictDoNothing();
        }
      }
    });

    console.log(`🎁 [Referidos] Recompensa asignada a referidor ${referrerId}: ${rewardType}`);
    console.log(`📊 [Referidos] Créditos asignados al referido ${refereeUserId}: +10`);
    console.log(`📊 [Referidos] Contadores actualizados para referidor ${referrerId}`);
    console.log(`🏅 [Referidos] Referidor ${referrerId} tiene ${convertedCount} referidos convertidos`);

    trackGamification(referrerId, "referral_converted").catch((e) => console.warn("[gamification] trackGamification failed:", e));
    console.log(`✅ [Referidos] Proceso de conversión completado para usuario ${refereeUserId}`);
    return true;
  } catch (error) {
    console.error("❌ [Referidos] Error en convertReferral:", error);
    return false;
  }
}
