import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

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

    const { priceId, referralCode } = await req.json();

    if (!priceId || !PRICE_IDS[priceId]) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    console.log("🔑 Creando sesión para:", priceId);
    console.log("📦 Price ID:", PRICE_IDS[priceId]);

    // Validate referral code server-side: reject self-referral before storing in Stripe metadata
    let validatedReferralCode: string | null = null;
    if (referralCode) {
      const [referral] = await db
        .select({ referrerId: schema.referrals.referrerId })
        .from(schema.referrals)
        .where(eq(schema.referrals.code, String(referralCode)))
        .limit(1);

      if (referral && referral.referrerId === userId) {
        console.log(`❌ [Stripe] Auto-referido bloqueado en checkout para usuario ${userId}`);
      } else if (referral) {
        validatedReferralCode = String(referralCode).slice(0, 80);
        console.log(`🔗 [Stripe] Checkout incluye referralCode validado: ${validatedReferralCode}`);
      } else {
        console.log(`⚠️ [Stripe] Código de referido no encontrado: ${referralCode}`);
      }
    }

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
        ...(validatedReferralCode ? { referralCode: validatedReferralCode } : {}),
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