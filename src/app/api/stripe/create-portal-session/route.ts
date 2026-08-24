import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { ratelimitPortalSession } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export async function POST() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-05-27.dahlia",
  });
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { success: withinLimit } = await ratelimitPortalSession.limit(userId);
    if (!withinLimit) {
      return NextResponse.json({ error: "Demasiadas peticiones. Inténtalo de nuevo en unos minutos." }, { status: 429 });
    }

    const [subscription] = await db
      .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No se encontró ninguna suscripción activa" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });

    log.info({ userId }, "Billing portal session created");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error({ err: error }, "Billing portal session creation error");
    return NextResponse.json(
      { error: "Error al abrir el portal de facturación" },
      { status: 500 }
    );
  }
}
