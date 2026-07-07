import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { convertReferral } from "@/lib/referrals/convert";
import { clerkClient } from "@clerk/nextjs/server";
import { addCredits } from "@/lib/credits/use-credits";
import { planFromPriceId, parseAgentCredits } from "@/lib/stripe/price-plan";
import { ensureUser } from "@/lib/user/ensure-user";
import { trackGamification } from "@/lib/gamification/track";
import { sendEmail } from "@/lib/email/send";
import { churnPreventionTemplate } from "@/lib/email/templates";
import { log } from "@/lib/logger";
import { redis } from "@/lib/redis";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;


export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-05-27.dahlia",
  });
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      log.error({ err }, "Stripe webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Idempotency: skip if this event was already processed (Stripe retries up to 72h)
    const idempotencyKey = `stripe:event:${event.id}`;
    const isNew = await redis.set(idempotencyKey, "1", { nx: true, ex: 90000 });
    if (!isNew) {
      log.info({ eventId: event.id, eventType: event.type }, "Stripe webhook duplicate — skipped");
      return NextResponse.json({ received: true });
    }

    log.info({ eventType: event.type }, "Stripe webhook received");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (!userId) {
          log.error({ eventType: event.type }, "checkout.session.completed: userId missing");
          break;
        }

        // Handle agent credit pack purchases
        const creditsToAdd = parseAgentCredits(session.metadata as Record<string, string | undefined> ?? {});
        if (creditsToAdd > 0) {
          log.info({ userId, credits: creditsToAdd }, "Agent credits purchased");
          await addCredits(
            userId,
            creditsToAdd,
            "purchase",
            `Pack ${creditsToAdd} créditos`,
            session.id
          );
          break;
        }

        const priceId = session.metadata?.priceId;

        if (!priceId) {
          log.error({ userId }, "checkout.session.completed: priceId missing");
          break;
        }

        const plan = planFromPriceId(priceId);
        if (!plan) {
          log.error({ userId, priceId }, "checkout.session.completed: unknown priceId");
          break;
        }

        log.info({ userId, plan }, "checkout.session.completed: payment received");

        // Auto-convert referral: look up by refereeId (set at registration time)
        const [pendingReferral] = await db
          .select()
          .from(schema.referrals)
          .where(
            and(
              eq(schema.referrals.refereeId, userId),
              or(eq(schema.referrals.status, "registered"), eq(schema.referrals.status, "pending"))
            )
          )
          .limit(1);

        if (pendingReferral) {
          const ok = await convertReferral(pendingReferral.id, userId, plan);
          if (ok) {
            log.info({ userId, referralId: pendingReferral.id }, "Referral converted");
          } else {
            log.warn({ userId, referralId: pendingReferral.id }, "Referral conversion failed silently");
          }
        }

        const existing = await db
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, userId))
          .limit(1);

        // Fetch actual period dates from Stripe (handles monthly AND annual correctly)
        let periodStart = Math.floor(Date.now() / 1000);
        let periodEnd = periodStart + 30 * 24 * 60 * 60;
        if (session.subscription) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as { current_period_start: number; current_period_end: number };
            periodStart = stripeSub.current_period_start;
            periodEnd = stripeSub.current_period_end;
          } catch (e) {
            log.warn({ err: e }, "Could not retrieve subscription period from Stripe");
          }
        }

        if (existing.length > 0) {
          await db
            .update(schema.subscriptions)
            .set({
              plan: plan,
              status: "active",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            })
            .where(eq(schema.subscriptions.userId, userId));
          log.info({ userId, plan }, "Subscription updated");
        } else {
          await db.insert(schema.subscriptions).values({
            id: uuidv4(),
            userId: userId,
            plan: plan,
            status: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          });
          log.info({ userId, plan }, "Subscription created");
        }

        // Sync plan to Clerk publicMetadata for instant client-side reads
        try {
          const clerk = await clerkClient();
          const clerkUser = await clerk.users.getUser(userId);
          await clerk.users.updateUserMetadata(userId, {
            publicMetadata: { ...clerkUser.publicMetadata, plan },
          });
          log.info({ userId, plan }, "Clerk metadata synced");
        } catch (metaErr) {
          log.warn({ err: metaErr }, "Could not sync Clerk metadata");
        }

        // Assign plan credits and update agentPlan in users table
        try {
          const planCredits: Record<string, number> = { pro: 1500, enterprise: 7000 };
          const credits = planCredits[plan] ?? 0;
          await ensureUser(userId);
          await db.update(schema.users)
            .set({ agentPlan: plan })
            .where(eq(schema.users.id, userId));
          if (credits > 0) {
            await addCredits(userId, credits, "bonus", `Créditos plan ${plan}`, session.id);
            log.info({ userId, plan, credits }, "Plan credits awarded");
          }
        } catch (creditErr) {
          log.warn({ err: creditErr }, "Could not assign plan credits");
        }

        trackGamification(userId, "upgrade_pro").catch((e) => log.warn({ err: e }, "trackGamification failed"));

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Skip the first payment — checkout.session.completed already handled it
        if (invoice.billing_reason === "subscription_create") break;

        const customerId = invoice.customer as string;
        const [sub] = await db
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (!sub) break;

        // Use Stripe's actual period dates — covers both monthly and annual renewals
        const newPeriodStart = invoice.period_start ?? Math.floor(Date.now() / 1000);
        const newPeriodEnd = invoice.period_end ?? (newPeriodStart + 30 * 24 * 60 * 60);

        await db.update(schema.subscriptions)
          .set({ status: "active", currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodEnd })
          .where(eq(schema.subscriptions.stripeCustomerId, customerId));

        const planCredits: Record<string, number> = { pro: 1500, enterprise: 7000 };
        const credits = planCredits[sub.plan] ?? 0;
        if (credits > 0) {
          await ensureUser(sub.userId);
          await addCredits(sub.userId, credits, "bonus", `Créditos renovación ${sub.plan}`, invoice.id ?? undefined);
          log.info({ userId: sub.userId, plan: sub.plan, credits }, "Renewal credits awarded");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await db
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (user.length > 0) {
          const canceledPlan = user[0].plan;
          await db
            .update(schema.subscriptions)
            .set({ status: "canceled" })
            .where(eq(schema.subscriptions.id, user[0].id));
          log.info({ userId: user[0].userId, plan: canceledPlan }, "Subscription canceled");

          // Churn prevention email
          try {
            const clerk = await clerkClient();
            const clerkUser = await clerk.users.getUser(user[0].userId);
            const email = clerkUser.emailAddresses[0]?.emailAddress;
            if (email) {
              await sendEmail({
                to: email,
                subject: "Sentimos verte ir — una oferta para que vuelvas",
                html: churnPreventionTemplate({ name: clerkUser.firstName ?? undefined, plan: canceledPlan }),
              });
            }
          } catch (e) {
            log.warn({ err: e }, "Could not send churn prevention email");
          }
        }
        break;
      }

      default:
        log.debug({ eventType: event.type }, "Unhandled Stripe webhook event");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error }, "Stripe webhook processing error");
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
