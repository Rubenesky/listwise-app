import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { log } from "@/lib/logger";

function generateReferralCode(): string {
  const random = randomBytes(6).toString("base64url").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `LISTWISE-${random}`;
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (existing?.referralCode) {
      return NextResponse.json({ code: existing.referralCode });
    }

    const code = generateReferralCode();

    await db
      .insert(schema.users)
      .values({ id: userId, referralCode: code })
      .onConflictDoUpdate({ target: schema.users.id, set: { referralCode: code } });

    log.info({ userId }, "Referral code generated");
    return NextResponse.json({ success: true, code });
  } catch (error) {
    log.error({ err: error }, "Referral code generation error");
    return NextResponse.json({ error: "Error al generar código" }, { status: 500 });
  }
}
