import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { addCredits } from "@/lib/credits/use-credits";
import { ensureUser } from "@/lib/user/ensure-user";

const BADGE_MAP: Record<number, { type: string; name: string; icon: string }> = {
  1: { type: "first_referral", name: "Primer Referido", icon: "🤝" },
  5: { type: "5_referrals", name: "5 Referidos", icon: "💫" },
  10: { type: "10_referrals", name: "10 Referidos", icon: "👑" },
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const cleanCode = code.trim();

    // Find referrer by personal referral code
    const [referrer] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.referralCode, cleanCode))
      .limit(1);

    if (!referrer) {
      return NextResponse.json({ error: "Código inválido" }, { status: 404 });
    }

    if (referrer.id === userId) {
      return NextResponse.json({ error: "No puedes usar tu propio código" }, { status: 400 });
    }

    await ensureUser(userId);

    // Idempotency: one referral per user
    const [existing] = await db
      .select({ id: schema.referrals.id })
      .from(schema.referrals)
      .where(eq(schema.referrals.refereeId, userId))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Ya tienes un referido registrado" }, { status: 409 });
    }

    // Get referee email from Clerk (non-blocking)
    let refereeEmail: string | null = null;
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      refereeEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;
    } catch {
      // Email is optional — don't fail the registration
    }

    const now = Math.floor(Date.now() / 1000);

    // DB has UNIQUE on code column — suffix with random bytes to avoid collision
    await db.insert(schema.referrals).values({
      id: uuidv4(),
      referrerId: referrer.id,
      refereeId: userId,
      email: refereeEmail,
      code: `${cleanCode}_${uuidv4().slice(0, 8)}`,
      status: "registered",
      createdAt: now,
      registeredAt: now,
    });

    // 10 credits to both parties
    await addCredits(userId, 10, "bonus", "Bienvenida: 10 créditos por registrarte con enlace de invitación");
    await addCredits(referrer.id, 10, "bonus", "Créditos por invitar a un nuevo usuario");

    // Increment referrer totalReferrals
    await db
      .update(schema.users)
      .set({ totalReferrals: sql`total_referrals + 1` })
      .where(eq(schema.users.id, referrer.id));

    // Award registration badge if milestone reached
    const [referrerData] = await db
      .select({ totalReferrals: schema.users.totalReferrals })
      .from(schema.users)
      .where(eq(schema.users.id, referrer.id))
      .limit(1);

    const total = referrerData?.totalReferrals ?? 0;

    // Check ALL milestones crossed — awards retroactively if a previous milestone was missed
    const earnedBadges = await db
      .select({ type: schema.badges.type })
      .from(schema.badges)
      .where(eq(schema.badges.userId, referrer.id));

    const earnedTypes = new Set(earnedBadges.map((b) => b.type));

    for (const [milestoneStr, badge] of Object.entries(BADGE_MAP)) {
      const milestone = parseInt(milestoneStr);
      if (total >= milestone && !earnedTypes.has(badge.type)) {
        await db
          .insert(schema.badges)
          .values({ id: uuidv4(), userId: referrer.id, type: badge.type, name: badge.name, icon: badge.icon, earnedAt: now })
          .onConflictDoNothing();
        console.log(`🏅 [Referidos] Insignia "${badge.name}" otorgada a ${referrer.id} (${total} registros >= ${milestone})`);
      }
    }

    console.log(`✅ [Referidos] Registrado: referee=${userId} (${refereeEmail}) → referrer=${referrer.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Referidos] Error en register:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
