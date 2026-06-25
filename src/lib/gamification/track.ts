import { db, schema } from "@/db";
import { eq, and, count, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ACTION_POINTS, DAILY_LIMITS, getLevelInfo } from "./constants";

/**
 * Records a gamification action directly in the DB.
 * Server-side only — bypasses HTTP rate limiting (trusted server calls).
 * Always call fire-and-forget: trackGamification(...).catch(() => {})
 */
export async function trackGamification(userId: string, action: string): Promise<void> {
  const points = ACTION_POINTS[action];
  if (!points) return;

  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86400;

  // Check daily limit (use pro limits for server-generated actions)
  const limit = DAILY_LIMITS[action]?.pro ?? 999;
  const [countResult] = await db
    .select({ n: count() })
    .from(schema.gamificationHistory)
    .where(
      and(
        eq(schema.gamificationHistory.userId, userId),
        eq(schema.gamificationHistory.action, action),
        sql`${schema.gamificationHistory.createdAt} > ${dayAgo}`
      )
    );
  if ((countResult?.n ?? 0) >= limit) return;

  // Get or create gamification record
  let [record] = await db
    .select()
    .from(schema.gamification)
    .where(eq(schema.gamification.userId, userId))
    .limit(1);

  if (!record) {
    const id = uuidv4();
    await db.insert(schema.gamification).values({
      id, userId, points: 0, level: 1, badges: "[]", streak: 0, lastActivity: now, updatedAt: now,
    });
    record = { id, userId, points: 0, level: 1, badges: "[]", streak: 0, lastActivity: now, updatedAt: now };
  }

  const oldPoints = record.points ?? 0;
  const newPoints = oldPoints + points;
  const newLevelInfo = getLevelInfo(newPoints);

  // Badges
  const existing = JSON.parse((record.badges ?? "[]") as string) as string[];
  const newBadges = [...existing];
  if (action === "generate_product" && !existing.includes("first_product")) newBadges.push("first_product");
  if (action === "share_landing" && !existing.includes("sharer")) newBadges.push("sharer");
  if (action === "agent_chat" && !existing.includes("ai_user")) newBadges.push("ai_user");
  if (newLevelInfo.level >= 5 && !existing.includes("level_5")) newBadges.push("level_5");
  if (newLevelInfo.level >= 6 && !existing.includes("level_6")) newBadges.push("level_6");

  // Streak (day-based)
  const lastActivity = record.lastActivity ?? 0;
  const today = new Date().toDateString();
  const lastDay = lastActivity ? new Date(lastActivity * 1000).toDateString() : null;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let newStreak = record.streak ?? 1;
  if (lastDay !== today) {
    newStreak = lastDay === yesterday ? newStreak + 1 : 1;
  }

  await db.update(schema.gamification).set({
    points: newPoints,
    level: newLevelInfo.level,
    badges: JSON.stringify(newBadges),
    streak: newStreak,
    lastActivity: now,
    updatedAt: now,
  }).where(eq(schema.gamification.userId, userId));

  await db.insert(schema.gamificationHistory).values({
    id: uuidv4(), userId, action, points, createdAt: now,
  });

  console.log(`🎮 [Gamification] ${userId} +${points}pts (${action}) → ${newPoints} total`);
}
