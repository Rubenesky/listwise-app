import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getLevelInfo } from "@/lib/gamification/constants";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let [record] = await db
      .select()
      .from(schema.gamification)
      .where(eq(schema.gamification.userId, userId))
      .limit(1);

    if (!record) {
      const newId = uuidv4();
      const now = Math.floor(Date.now() / 1000);
      await db.insert(schema.gamification).values({
        id: newId,
        userId,
        points: 0,
        level: 1,
        badges: "[]",
        streak: 0,
        lastActivity: null,
        updatedAt: now,
      });
      record = {
        id: newId,
        userId,
        points: 0,
        level: 1,
        badges: "[]",
        streak: 0,
        lastActivity: null,
        updatedAt: now,
      };
    }

    const levelInfo = getLevelInfo(record.points ?? 0);
    const badges = JSON.parse((record.badges ?? "[]") as string) as string[];

    return NextResponse.json({
      points: record.points ?? 0,
      level: levelInfo.level,
      levelName: levelInfo.name,
      levelIcon: levelInfo.icon,
      currentLevelPoints: levelInfo.currentLevelPoints,
      nextLevelPoints: levelInfo.nextLevelPoints,
      nextLevelName: levelInfo.nextLevelName,
      isMaxLevel: levelInfo.isMaxLevel,
      streak: record.streak ?? 0,
      badges,
    });
  } catch (error) {
    console.error("❌ [Gamification Status] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
