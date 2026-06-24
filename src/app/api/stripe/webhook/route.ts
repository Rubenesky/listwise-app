import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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
        const priceId = session.metadata?.priceId;

        if (!userId) {
          console.error("❌ userId no encontrado");
          break;
        }

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

        // Check if this subscriber was referred — read-only, for debug visibility
        const [referralRecord] = await db
          .select({ code: schema.referrals.code, referrerId: schema.referrals.referrerId })
          .from(schema.referrals)
          .where(eq(schema.referrals.refereeId, userId))
          .limit(1);
        if (referralRecord) {
          console.log(`🔗 [Stripe Webhook] Usuario ${userId} fue referido con código: ${referralRecord.code} (por: ${referralRecord.referrerId})`);
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