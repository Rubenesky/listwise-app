import { NextResponse } from "next/server";
import { db, schema } from "@/db";
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

  // All user IDs in our DB
  const allUsers = await db.select({ userId: schema.users.id }).from(schema.users);
  if (allUsers.length === 0) return NextResponse.json({ total: 0, sent: 0, failed: 0 });

  // User IDs that have at least one listing
  const listingsRows = await db
    .selectDistinct({ userId: schema.listings.userId })
    .from(schema.listings);
  const hasListings = new Set(listingsRows.map((r) => r.userId));

  // Users with zero listings
  const noListingIds = allUsers
    .map((u) => u.userId)
    .filter((id) => !hasListings.has(id));

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
        } catch {
          failed++;
        }
      }
    } catch {
      failed += batch.length;
    }
  }

  return NextResponse.json({ total: noListingIds.length, sent, failed });
}
