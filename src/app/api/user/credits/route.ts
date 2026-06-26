import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { ensureUser } from "@/lib/user/ensure-user";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    await ensureUser(userId);

    const [user] = await db
      .select({ agentCredits: schema.users.agentCredits, agentPlan: schema.users.agentPlan })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return NextResponse.json({
      credits: user?.agentCredits ?? 10,
      plan: user?.agentPlan ?? "free",
    });
  } catch (error) {
    console.error("❌ [Credits] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
