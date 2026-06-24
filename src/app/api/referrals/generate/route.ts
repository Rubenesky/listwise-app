import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

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

    console.log(`🔑 [Referidos] Generando código para usuario: ${userId}`);

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (existing?.referralCode) {
      console.log(`🔑 [Referidos] Código existente recuperado: ${existing.referralCode} para usuario: ${userId}`);
      return NextResponse.json({ code: existing.referralCode });
    }

    const code = generateReferralCode();

    // Upsert: creates the row if it doesn't exist yet
    await db
      .insert(schema.users)
      .values({ id: userId, referralCode: code })
      .onConflictDoUpdate({ target: schema.users.id, set: { referralCode: code } });

    console.log(`✅ [Referidos] Código generado: ${code} para usuario: ${userId}`);
    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error("Error generando código:", error);
    return NextResponse.json({ error: "Error al generar código" }, { status: 500 });
  }
}
