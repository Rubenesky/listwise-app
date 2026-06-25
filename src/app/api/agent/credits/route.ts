import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const CREDIT_PACKS = [
  { id: "pack_s", credits: 20, priceId: process.env.STRIPE_PACK_S_PRICE_ID },
  { id: "pack_m", credits: 50, priceId: process.env.STRIPE_PACK_M_PRICE_ID },
  { id: "pack_l", credits: 100, priceId: process.env.STRIPE_PACK_L_PRICE_ID },
];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { packId } = await req.json();
    const pack = CREDIT_PACKS.find((p) => p.id === packId);

    if (!pack) {
      return NextResponse.json({ error: "Pack no válido" }, { status: 400 });
    }

    if (!pack.priceId) {
      return NextResponse.json({ error: "Pack no configurado" }, { status: 400 });
    }

    console.log(`💰 [Agent Credits] Usuario ${userId} comprando pack ${packId} (${pack.credits} consultas)`);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits_success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits_canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        credits: pack.credits.toString(),
        type: "agent_credits",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("❌ [Agent Credits] Error al crear sesión:", error);
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 });
  }
}
