import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { getLevelInfo } from "@/lib/gamification/constants";

interface RankingItem {
  rank: number;
  userId: string;
  nickname: string;
  points: number;
  level: number;
  levelName: string;
  levelIcon: string;
  badges: string[];
}

const ADJECTIVES = ["Ágil", "Veloz", "Experto", "Digital", "Global", "Pro", "Élite", "Maestro", "Dinámico", "Rápido", "Audaz", "Brillante"];
const NOUNS = ["Vendedor", "Trader", "Marketer", "Seller", "Emprendedor", "Experto", "Creador", "Estratega"];

function generateNickname(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >> 4) % NOUNS.length];
  const num = ((h >> 8) % 900) + 100;
  return `${adj} ${noun} #${num}`;
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
        nickname: generateNickname(user.userId),
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
