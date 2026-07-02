import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, lt, gte, isNotNull } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/email/send";
import { reEngagementTemplate } from "@/lib/email/templates";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60;

  const clerk = await clerkClient();
  let sent = 0;
  let failed = 0;
  const sentTo = new Set<string>();

  // Segment A: users who were active but went inactive (7-14 days without tracked activity)
  const activeThenInactive = await db
    .select({ userId: schema.gamification.userId })
    .from(schema.gamification)
    .where(
      and(
        isNotNull(schema.gamification.lastActivity),
        lt(schema.gamification.lastActivity, sevenDaysAgo),
        gte(schema.gamification.lastActivity, fourteenDaysAgo)
      )
    );

  for (const { userId } of activeThenInactive) {
    if (sentTo.has(userId)) continue;
    try {
      const user = await clerk.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: "¿Todo bien? Tu catálogo te echa de menos 👋",
        html: reEngagementTemplate({ name: user.firstName ?? undefined }),
      });
      sentTo.add(userId);
      sent++;
    } catch {
      failed++;
    }
  }

  // Segment B: registered users who never performed any tracked action (no gamification row)
  // Target: accounts created between 7 and 60 days ago — missed by the activation nudge (48-72h)
  const gamificationIds = new Set(
    (await db.select({ userId: schema.gamification.userId }).from(schema.gamification))
      .map((r) => r.userId)
  );

  const neverActiveIds = (await db.select({ id: schema.users.id }).from(schema.users))
    .map((r) => r.id)
    .filter((id) => !gamificationIds.has(id));

  const sevenDaysAgo_ms = sevenDaysAgo * 1000;
  const sixtyDaysAgo_ms = sixtyDaysAgo * 1000;

  for (let i = 0; i < neverActiveIds.length; i += 100) {
    const batch = neverActiveIds.slice(i, i + 100);
    try {
      const { data: clerkUsers } = await clerk.users.getUserList({ userId: batch, limit: 100 });
      for (const user of clerkUsers) {
        if (sentTo.has(user.id)) continue;
        if (user.createdAt > sevenDaysAgo_ms || user.createdAt < sixtyDaysAgo_ms) continue;
        const email = user.emailAddresses[0]?.emailAddress;
        if (!email) continue;
        try {
          await sendEmail({
            to: email,
            subject: "¿Todo bien? Tu catálogo te echa de menos 👋",
            html: reEngagementTemplate({ name: user.firstName ?? undefined }),
          });
          sentTo.add(user.id);
          sent++;
        } catch {
          failed++;
        }
      }
    } catch {
      failed += batch.length;
    }
  }

  return NextResponse.json({ total: activeThenInactive.length + neverActiveIds.length, sent, failed });
}
