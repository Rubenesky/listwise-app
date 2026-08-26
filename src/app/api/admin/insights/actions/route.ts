import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { count, desc } from "drizzle-orm";
import { log } from "@/lib/logger";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

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
    log.error({ err: error }, "Admin insights actions error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
