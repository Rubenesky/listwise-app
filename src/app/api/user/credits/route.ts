import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const [user] = await db
      .select({ agentCredits: schema.users.agentCredits, agentPlan: schema.users.agentPlan })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const plan = user?.agentPlan ?? "free";
    const credits = user?.agentCredits ?? 0;
    const unlimited = plan !== "free";

    return NextResponse.json({
      credits: unlimited ? null : credits,
      plan,
      unlimited,
    });
  } catch (error) {
    console.error("❌ [Credits] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
