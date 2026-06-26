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
  agent_pack_s: "price_1Tm1Ki1uySlskct3jd7NLdA3",
  agent_pack_m: "price_1Tm1M41uySlskct3fECTVMZp",
  agent_pack_l: "price_1Tm1Mk1uySlskct3eKYmbioP",
};

// One-time payment packs (not subscriptions)
const ONE_TIME_PRICE_IDS = new Set(["agent_pack_s", "agent_pack_m", "agent_pack_l"]);

const PACK_CREDITS: Record<string, number> = {
  agent_pack_s: 20,
  agent_pack_m: 50,
  agent_pack_l: 100,
};

const PLAN_NAMES: Record<string, string> = {
  pro: "Pro",
  enterprise: "Enterprise",
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

    const isOneTime = ONE_TIME_PRICE_IDS.has(priceId);

    // Guard: block duplicate subscriptions (not applicable to one-time packs)
    if (!isOneTime) {
      const [existing] = await db
        .select({ plan: schema.subscriptions.plan, status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId))
        .limit(1);

      if (existing && existing.status === "active") {
        if (existing.plan === priceId) {
          return NextResponse.json({
            error: `Ya tienes una suscripción activa al Plan ${PLAN_NAMES[priceId] ?? priceId}.`,
            currentPlan: existing.plan,
            alreadySubscribed: true,
          }, { status: 409 });
        }
        if (existing.plan === "enterprise") {
          return NextResponse.json({
            error: "Ya tienes el Plan Enterprise, que es el plan máximo disponible.",
            currentPlan: "enterprise",
            alreadySubscribed: true,
          }, { status: 409 });
        }
      }
    }

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
      mode: isOneTime ? "payment" : "subscription",
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
        // Credit packs need type + credits so the webhook knows what to add
        ...(isOneTime ? { type: "agent_credits", credits: (PACK_CREDITS[priceId] ?? 0).toString() } : {}),
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