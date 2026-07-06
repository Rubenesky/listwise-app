import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [user] = await db
      .select({ agentCredits: schema.users.agentCredits, agentPlan: schema.users.agentPlan })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return NextResponse.json({
      credits: user?.agentCredits ?? 0,
      plan: user?.agentPlan ?? "free",
    });
  } catch (error) {
    log.error({ err: error }, "agent/credits/status error");
    return NextResponse.json({ error: "Error al obtener créditos" }, { status: 500 });
  }
}
