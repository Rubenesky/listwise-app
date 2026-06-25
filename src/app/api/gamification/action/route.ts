import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, count, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { ratelimitGamification } from "@/lib/rate-limit";
import {
  ACTION_POINTS,
  DAILY_LIMITS,
  VALID_ACTIONS,
  getLevelInfo,
} from "@/lib/gamification/constants";

const bodySchema = z.object({
  action: z.string().refine((v) => VALID_ACTIONS.includes(v), { message: "Acción inválida" }),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { success } = await ratelimitGamification.limit(`gamification:${userId}`);
    if (!success) {
      return NextResponse.json({ error: "Demasiadas peticiones. Intenta más tarde." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }
    const { action } = parsed.data;

    // Get user plan from subscriptions
    const [subscription] = await db
      .select({ plan: schema.subscriptions.plan })
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, "active")))
      .limit(1);
    const isPro = subscription?.plan === "pro" || subscription?.plan === "enterprise";

    // Check daily limit via DB count
    const limits = DAILY_LIMITS[action];
    const dailyLimit = isPro ? limits.pro : limits.free;
    const dayAgo = Math.floor(Date.now() / 1000) - 86400;

    const countResult = await db
      .select({ actionCount: count() })
      .from(schema.gamificationHistory)
      .where(
        and(
          eq(schema.gamificationHistory.userId, userId),
          eq(schema.gamificationHistory.action, action),
          sql`${schema.gamificationHistory.createdAt} > ${dayAgo}`
        )
      );
    const actionCount = countResult[0]?.actionCount ?? 0;

    if (actionCount >= dailyLimit) {
      return NextResponse.json({ error: "Límite diario alcanzado para esta acción", limitReached: true }, { status: 429 });
    }

    // Get or create gamification record
    let [record] = await db
      .select()
      .from(schema.gamification)
      .where(eq(schema.gamification.userId, userId))
      .limit(1);

    const now = Math.floor(Date.now() / 1000);
    if (!record) {
      const newId = uuidv4();
      await db.insert(schema.gamification).values({
        id: newId, userId, points: 0, level: 1, badges: "[]", streak: 0, lastActivity: now, updatedAt: now,
      });
      record = { id: newId, userId, points: 0, level: 1, badges: "[]", streak: 0, lastActivity: now, updatedAt: now };
    }

    const pointsToAdd = ACTION_POINTS[action];
    const oldPoints = record.points ?? 0;
    const newPoints = oldPoints + pointsToAdd;

    const oldLevelInfo = getLevelInfo(oldPoints);
    const newLevelInfo = getLevelInfo(newPoints);
    const leveledUp = newLevelInfo.level > oldLevelInfo.level;

    // Compute new badges
    const existingBadges = JSON.parse((record.badges ?? "[]") as string) as string[];
    const newBadges = [...existingBadges];
    if (newLevelInfo.level >= 5 && !existingBadges.includes("level_5")) newBadges.push("level_5");
    if (newLevelInfo.level >= 6 && !existingBadges.includes("level_6")) newBadges.push("level_6");
    if (action === "generate_product" && !existingBadges.includes("first_product")) newBadges.push("first_product");
    if (action === "share_landing" && !existingBadges.includes("sharer")) newBadges.push("sharer");
    if (action === "agent_chat" && !existingBadges.includes("ai_user")) newBadges.push("ai_user");

    // Update streak (day-based)
    const lastActivity = record.lastActivity ?? 0;
    const todayStr = new Date().toDateString();
    const lastActivityStr = lastActivity ? new Date(lastActivity * 1000).toDateString() : null;
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    let newStreak = record.streak ?? 1;
    if (lastActivityStr !== todayStr) {
      newStreak = lastActivityStr === yesterdayStr ? newStreak + 1 : 1;
    }

    // Update gamification record
    await db
      .update(schema.gamification)
      .set({ points: newPoints, level: newLevelInfo.level, badges: JSON.stringify(newBadges), streak: newStreak, lastActivity: now, updatedAt: now })
      .where(eq(schema.gamification.userId, userId));

    // Insert history
    await db.insert(schema.gamificationHistory).values({
      id: uuidv4(), userId, action, points: pointsToAdd, createdAt: now,
    });

    // Award discount code on level up to 5 or 6
    if (leveledUp && (newLevelInfo.level === 5 || newLevelInfo.level === 6)) {
      const discountType = `level_${newLevelInfo.level}`;
      const [existingDiscount] = await db
        .select()
        .from(schema.gamificationDiscounts)
        .where(and(eq(schema.gamificationDiscounts.userId, userId), eq(schema.gamificationDiscounts.type, discountType)))
        .limit(1);
      if (!existingDiscount) {
        const code = `LISTWISE_${newLevelInfo.name.toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        await db.insert(schema.gamificationDiscounts).values({
          id: uuidv4(), userId, type: discountType, code, used: 0,
          expiresAt: now + 90 * 24 * 60 * 60,
          createdAt: now,
        });
        console.log(`🎁 [Gamification] Discount awarded to ${userId}: ${code}`);
      }
    }

    console.log(`🎮 [Gamification] ${userId} +${pointsToAdd}pts (${action}) → total: ${newPoints}`);

    return NextResponse.json({
      success: true,
      pointsAdded: pointsToAdd,
      totalPoints: newPoints,
      level: newLevelInfo.level,
      levelName: newLevelInfo.name,
      levelIcon: newLevelInfo.icon,
      leveledUp,
      newBadges: newBadges.filter((b) => !existingBadges.includes(b)),
      streak: newStreak,
    });
  } catch (error) {
    console.error("❌ [Gamification Action] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
