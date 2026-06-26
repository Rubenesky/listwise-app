import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { addCredits } from "@/lib/credits/use-credits";
import { ensureUser } from "@/lib/user/ensure-user";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const cleanCode = code.trim();

    // Find referrer by their personal referral code stored in users table
    const [referrer] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.referralCode, cleanCode))
      .limit(1);

    if (!referrer) {
      return NextResponse.json({ error: "Código inválido" }, { status: 404 });
    }

    // Block self-referral
    if (referrer.id === userId) {
      return NextResponse.json({ error: "No puedes usar tu propio código" }, { status: 400 });
    }

    await ensureUser(userId);

    // Idempotency: check if this user already has a referral registered
    const [existing] = await db
      .select({ id: schema.referrals.id })
      .from(schema.referrals)
      .where(eq(schema.referrals.refereeId, userId))
      .limit(1);

    if (existing) {
      // 409 signals "already done" — client should clean localStorage
      return NextResponse.json({ error: "Ya tienes un referido registrado" }, { status: 409 });
    }

    const now = Math.floor(Date.now() / 1000);

    // Create referral record — code must be unique in DB, so suffix with random bytes
    await db.insert(schema.referrals).values({
      id: uuidv4(),
      referrerId: referrer.id,
      refereeId: userId,
      code: `${cleanCode}_${uuidv4().slice(0, 8)}`,
      status: "registered",
      createdAt: now,
      registeredAt: now,
    });

    // Give 10 agentCredits to the new user (referee)
    await addCredits(userId, 10, "bonus", "Bienvenida: créditos por registrarte con enlace de invitación");

    // Give 10 agentCredits to the referrer
    await addCredits(referrer.id, 10, "bonus", "Créditos por invitar a un nuevo usuario");

    // Increment referrer's totalReferrals counter
    await db
      .update(schema.users)
      .set({ totalReferrals: sql`total_referrals + 1` })
      .where(eq(schema.users.id, referrer.id));

    console.log(`✅ [Referidos] Registrado: referee=${userId} → referrer=${referrer.id} código=${cleanCode}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Referidos] Error en register:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
