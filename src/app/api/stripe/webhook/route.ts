import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { convertReferral } from "@/lib/referrals/convert";
import { clerkClient } from "@clerk/nextjs/server";
import { addCredits } from "@/lib/credits/use-credits";
import { ensureUser } from "@/lib/user/ensure-user";
import { trackGamification } from "@/lib/gamification/track";
import { sendEmail } from "@/lib/email/send";
import { churnPreventionTemplate } from "@/lib/email/templates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1Tl68X1uySlskct3CuBf7pjw": "pro",
  "price_1Tl69t1uySlskct3TIl1qBqc": "enterprise",
  "price_1TncET1uySlskct3tPbtAzJA": "pro",
  "price_1TncFM1uySlskct3Lin2vkKE": "enterprise",
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`📨 Evento recibido: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (!userId) {
          console.error("❌ userId no encontrado");
          break;
        }

        // Handle agent credit pack purchases
        if (session.metadata?.type === "agent_credits") {
          const creditsToAdd = parseInt(session.metadata.credits ?? "0", 10);
          if (creditsToAdd > 0) {
            console.log(`💰 [Stripe Webhook] +${creditsToAdd} créditos de agente para ${userId}`);
            await addCredits(
              userId,
              creditsToAdd,
              "purchase",
              `Pack ${creditsToAdd} créditos`,
              session.id
            );
            console.log(`✅ [Stripe Webhook] Créditos de agente actualizados para ${userId}`);
          }
          break;
        }

        const priceId = session.metadata?.priceId;

        if (!priceId) {
          console.error("❌ priceId no encontrado");
          break;
        }

        const plan = PRICE_TO_PLAN[priceId];
        if (!plan) {
          console.error(`❌ Price ID desconocido: ${priceId}`);
          break;
        }

        console.log(`📨 [Stripe Webhook] Pago completado para usuario: ${userId}, plan: ${plan}`);

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
          console.log(`💰 [Stripe Webhook] Referido encontrado para ${userId}, convirtiendo: ${pendingReferral.id}`);
          const ok = await convertReferral(pendingReferral.id, userId, plan);
          if (ok) {
            console.log(`✅ [Stripe Webhook] Referido convertido para usuario ${userId}`);
          } else {
            console.log(`⚠️ [Stripe Webhook] Conversión de referido falló silenciosamente para ${userId}`);
          }
        } else {
          console.log(`ℹ️ [Stripe Webhook] Usuario ${userId} no tiene referido registrado`);
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
            console.warn("⚠️ [Stripe Webhook] No se pudo obtener periodo de suscripción:", e);
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
          console.log(`✅ Suscripción actualizada para usuario ${userId} a plan ${plan}`);
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
          console.log(`✅ Nueva suscripción creada para usuario ${userId} a plan ${plan}`);
        }

        // Sync plan to Clerk publicMetadata for instant client-side reads
        try {
          const clerk = await clerkClient();
          const clerkUser = await clerk.users.getUser(userId);
          await clerk.users.updateUserMetadata(userId, {
            publicMetadata: { ...clerkUser.publicMetadata, plan },
          });
          console.log(`✅ [Stripe Webhook] Clerk metadata sincronizada: ${userId} → ${plan}`);
        } catch (metaErr) {
          console.warn("⚠️ [Stripe Webhook] No se pudo sincronizar Clerk metadata:", metaErr);
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
            console.log(`✅ [Stripe Webhook] +${credits} créditos plan ${plan} para ${userId}`);
          }
        } catch (creditErr) {
          console.warn("⚠️ [Stripe Webhook] No se pudieron asignar créditos del plan:", creditErr);
        }

        trackGamification(userId, "upgrade_pro").catch(() => {});

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
          console.log(`✅ [Stripe Webhook] +${credits} créditos renovación ${sub.plan} para ${sub.userId}`);
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
          console.log(`❌ Suscripción cancelada para usuario ${user[0].userId}`);

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
            console.warn("⚠️ [Stripe Webhook] No se pudo enviar email de churn:", e);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}