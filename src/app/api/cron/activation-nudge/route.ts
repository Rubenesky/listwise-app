import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, isNull } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/email/send";
import { activationNudgeTemplate } from "@/lib/email/templates";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = Date.now();
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
  const seventyTwoHoursAgo = now - 72 * 60 * 60 * 1000;

  // Users with zero listings — single LEFT JOIN instead of two full-table scans
  const noListingRows = await db
    .select({ userId: schema.users.id })
    .from(schema.users)
    .leftJoin(schema.listings, eq(schema.users.id, schema.listings.userId))
    .where(isNull(schema.listings.id));

  const noListingIds = noListingRows.map((r) => r.userId);

  if (noListingIds.length === 0) return NextResponse.json({ total: 0, sent: 0, failed: 0 });

  const clerk = await clerkClient();
  let sent = 0;
  let failed = 0;

  // Process in batches of 100 (Clerk API limit)
  for (let i = 0; i < noListingIds.length; i += 100) {
    const batch = noListingIds.slice(i, i + 100);
    try {
      const { data: clerkUsers } = await clerk.users.getUserList({
        userId: batch,
        limit: 100,
      });

      for (const user of clerkUsers) {
        // Only target users created between 48h and 72h ago
        if (user.createdAt < seventyTwoHoursAgo || user.createdAt > fortyEightHoursAgo) continue;

        const email = user.emailAddresses[0]?.emailAddress;
        if (!email) continue;

        try {
          await sendEmail({
            to: email,
            subject: "¿Aún tienes los 20 créditos esperando? 👀",
            html: activationNudgeTemplate({ name: user.firstName ?? undefined }),
          });
          sent++;
        } catch (emailErr) {
          console.warn(`[cron:activation] Email failed for ${email}:`, emailErr);
          failed++;
        }
      }
    } catch (batchErr) {
      console.warn(`[cron:activation] Batch fetch failed (size ${batch.length}):`, batchErr);
      failed += batch.length;
    }
  }

  return NextResponse.json({ total: noListingIds.length, sent, failed });
}
