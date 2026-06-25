import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { count, sum, sql } from "drizzle-orm";
import { LEVELS } from "@/lib/gamification/constants";

const ADMIN_USER_IDS = ["user_3FKeQMYvlFqlnt1QqG8pURl1ARl"];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    // Active users (distinct) in last 30 days
    const activeUsersResult = await db
      .selectDistinct({ userId: schema.gamificationHistory.userId })
      .from(schema.gamificationHistory)
      .where(sql`${schema.gamificationHistory.createdAt} > ${thirtyDaysAgo}`);
    const activeUsers = activeUsersResult.length;

    // Total points across all users
    const [pointsResult] = await db
      .select({ total: sum(schema.gamification.points) })
      .from(schema.gamification);
    const totalPoints = Number(pointsResult?.total ?? 0);

    // Total registered users in gamification
    const [totalUsersResult] = await db
      .select({ total: count() })
      .from(schema.gamification);
    const totalUsers = totalUsersResult?.total ?? 0;

    // Level distribution
    const levelCounts = await db
      .select({ level: schema.gamification.level, count: count() })
      .from(schema.gamification)
      .groupBy(schema.gamification.level);

    const levelDistribution = LEVELS.map((l) => {
      const found = levelCounts.find((r) => (r.level ?? 1) === l.level);
      return { level: l.level, name: l.name, icon: l.icon, count: found?.count ?? 0 };
    });

    return NextResponse.json({ activeUsers, totalPoints, totalUsers, levelDistribution });
  } catch (error) {
    console.error("❌ [Admin Insights Summary] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
