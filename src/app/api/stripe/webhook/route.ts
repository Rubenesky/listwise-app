import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { convertReferral } from "@/lib/referrals/convert";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1Tl68X1uySlskct3CuBf7pjw": "pro",
  "price_1Tl69t1uySlskct3TIl1qBqc": "enterprise",
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
            await db.update(schema.users)
              .set({ agentCredits: sql`agent_credits + ${creditsToAdd}` })
              .where(eq(schema.users.id, userId));
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

        // Auto-convert referral if the checkout included a referral code
        const referralCode = session.metadata?.referralCode;
        if (referralCode) {
          console.log(`🔗 [Stripe Webhook] Usuario ${userId} tiene código de referido: ${referralCode}`);

          const [pendingReferral] = await db
            .select()
            .from(schema.referrals)
            .where(eq(schema.referrals.code, referralCode))
            .limit(1);

          if (pendingReferral && pendingReferral.status !== "converted") {
            console.log(`💰 [Stripe Webhook] Referido encontrado, convirtiendo: ${pendingReferral.id}`);
            const ok = await convertReferral(pendingReferral.id, userId, plan);
            if (ok) {
              console.log(`✅ [Stripe Webhook] Referido convertido automáticamente para usuario ${userId}`);
            } else {
              console.log(`⚠️ [Stripe Webhook] Conversión de referido falló silenciosamente para ${userId}`);
            }
          } else {
            console.log(`ℹ️ [Stripe Webhook] Código ${referralCode} no tiene referido pendiente`);
          }
        } else {
          console.log(`ℹ️ [Stripe Webhook] Usuario ${userId} no tiene código de referido registrado`);
        }

        const existing = await db
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(schema.subscriptions)
            .set({
              plan: plan,
              status: "active",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              currentPeriodStart: Math.floor(Date.now() / 1000),
              currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
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
            currentPeriodStart: Math.floor(Date.now() / 1000),
            currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
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
          await db
            .update(schema.subscriptions)
            .set({ status: "canceled" })
            .where(eq(schema.subscriptions.id, user[0].id));
          console.log(`❌ Suscripción cancelada para usuario ${user[0].userId}`);
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