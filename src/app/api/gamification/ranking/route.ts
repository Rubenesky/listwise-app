import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { getLevelInfo } from "@/lib/gamification/constants";

interface RankingItem {
  rank: number;
  userId: string;
  points: number;
  level: number;
  levelName: string;
  levelIcon: string;
  badges: string[];
}

let rankingCache: { data: RankingItem[]; expiresAt: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();

    if (rankingCache && rankingCache.expiresAt > now) {
      return NextResponse.json({ ranking: rankingCache.data });
    }

    const topUsers = await db
      .select()
      .from(schema.gamification)
      .orderBy(desc(schema.gamification.points))
      .limit(50);

    const ranking: RankingItem[] = topUsers.map((user, index) => {
      const levelInfo = getLevelInfo(user.points ?? 0);
      return {
        rank: index + 1,
        userId: user.userId,
        points: user.points ?? 0,
        level: levelInfo.level,
        levelName: levelInfo.name,
        levelIcon: levelInfo.icon,
        badges: JSON.parse((user.badges ?? "[]") as string) as string[],
      };
    });

    rankingCache = { data: ranking, expiresAt: now + 5 * 60 * 1000 };

    return NextResponse.json({ ranking });
  } catch (error) {
    console.error("❌ [Gamification Ranking] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
