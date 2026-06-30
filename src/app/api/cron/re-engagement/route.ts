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

  const candidates = await db
    .select({ userId: schema.gamification.userId })
    .from(schema.gamification)
    .where(
      and(
        isNotNull(schema.gamification.lastActivity),
        lt(schema.gamification.lastActivity, sevenDaysAgo),
        gte(schema.gamification.lastActivity, fourteenDaysAgo)
      )
    );

  const clerk = await clerkClient();
  let sent = 0;
  let failed = 0;

  for (const { userId } of candidates) {
    try {
      const user = await clerk.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      await sendEmail({
        to: email,
        subject: "¿Todo bien? Tu catálogo te echa de menos 👋",
        html: reEngagementTemplate({ name: user.firstName ?? undefined }),
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: candidates.length, sent, failed });
}
