import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const PRICE_IDS: Record<string, string> = {
  pro: "price_1Tl68X1uySlskct3CuBf7pjw",
  enterprise: "price_1Tl69t1uySlskct3TIl1qBqc",
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { priceId } = await req.json();

    if (!priceId || !PRICE_IDS[priceId]) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    console.log("🔑 Creando sesión para:", priceId);
    console.log("📦 Price ID:", PRICE_IDS[priceId]);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: PRICE_IDS[priceId],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        priceId: PRICE_IDS[priceId],
      },
    });

    console.log("✅ Sesión creada:", session.id);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error al crear la sesión de pago" },
      { status: 500 }
    );
  }
}