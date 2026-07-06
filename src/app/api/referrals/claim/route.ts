import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { addCredits } from "@/lib/credits/use-credits";
import Stripe from "stripe";
import { log } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const COUPON_ID = "LISTWISE_REFERRAL_FREE_MONTH";

const FALLBACK_CREDITS: Record<string, number> = {
  free_month_pro: 1500,
  free_month_enterprise: 7000,
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { rewardId } = await req.json();

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID requerido" }, { status: 400 });
    }

    // Fetch first to check ownership before any mutation
    const [reward] = await db
      .select()
      .from(schema.referralRewards)
      .where(eq(schema.referralRewards.id, rewardId))
      .limit(1);

    if (!reward) {
      return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });
    }

    if (reward.userId !== userId) {
      log.warn({ userId, rewardId }, "Referral reward ownership mismatch");
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
      log.warn({ userId, rewardId }, "Referral reward already claimed (race condition prevented)");
      return NextResponse.json({ error: "Recompensa no disponible" }, { status: 409 });
    }

    const claimed = updated[0];
    log.info({ userId, rewardId, type: claimed.type }, "Referral reward claimed");

    if (claimed.type === "credit" && claimed.amount) {
      await db
        .insert(schema.users)
        .values({ id: userId, credits: claimed.amount })
        .onConflictDoUpdate({ target: schema.users.id, set: { credits: sql`credits + ${claimed.amount}` } });
      log.info({ userId, credits: claimed.amount }, "Credits added from referral reward");
    } else if (claimed.type === "free_month_pro" || claimed.type === "free_month_enterprise") {
      // Try Stripe coupon first if user has an active subscription
      const [activeSub] = await db
        .select({ stripeSubscriptionId: schema.subscriptions.stripeSubscriptionId })
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, "active")))
        .limit(1);

      if (activeSub?.stripeSubscriptionId) {
        await stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
          discounts: [{ coupon: COUPON_ID }],
        });
        log.info({ userId, subscriptionId: activeSub.stripeSubscriptionId }, "Stripe coupon applied");
      } else {
        // Fallback: user not subscribed yet — give equivalent credits
        const creditsToAdd = FALLBACK_CREDITS[claimed.type] ?? 1500;
        const label = claimed.type === "free_month_enterprise" ? "1 mes Enterprise gratis" : "1 mes Pro gratis";
        await addCredits(userId, creditsToAdd, "bonus", `Recompensa por referido: ${label} (${creditsToAdd} créditos)`);
        log.info({ userId, credits: creditsToAdd, type: claimed.type }, "Referral fallback credits added");
      }
    }

    return NextResponse.json({ success: true, type: claimed.type });
  } catch (error) {
    log.error({ err: error }, "Referral claim error");
    return NextResponse.json({ error: "Error al reclamar recompensa" }, { status: 500 });
  }
}
