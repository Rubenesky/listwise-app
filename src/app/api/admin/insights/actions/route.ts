import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { count, desc } from "drizzle-orm";

const ADMIN_USER_IDS = ["user_3FKeQMYvlFqlnt1QqG8pURl1ARl"];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const actionCounts = await db
      .select({ action: schema.gamificationHistory.action, count: count() })
      .from(schema.gamificationHistory)
      .groupBy(schema.gamificationHistory.action)
      .orderBy(desc(count()));

    const total = actionCounts.reduce((sum, a) => sum + (a.count ?? 0), 0);

    const actions = actionCounts.map((a) => ({
      action: a.action,
      count: a.count ?? 0,
      percentage: total > 0 ? ((a.count ?? 0) / total) * 100 : 0,
    }));

    return NextResponse.json({ actions, total });
  } catch (error) {
    console.error("❌ [Admin Insights Actions] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
