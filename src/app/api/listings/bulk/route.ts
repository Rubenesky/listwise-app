import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db, schema } from "@/db";
import { log } from "@/lib/logger";

export async function DELETE(): Promise<NextResponse<{ deleted: number } | { error: string }>> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const failed = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(and(eq(schema.listings.userId, userId), eq(schema.listings.status, "FAILED")));

  if (failed.length === 0) return NextResponse.json({ deleted: 0 });

  const failedIds = failed.map((r) => r.id);
  await db.delete(schema.listings).where(inArray(schema.listings.id, failedIds));

  return NextResponse.json({ deleted: failedIds.length });
}

export async function POST(): Promise<NextResponse<{ retrying: number } | { error: string }>> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const failed = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(and(eq(schema.listings.userId, userId), eq(schema.listings.status, "FAILED")));

  if (failed.length === 0) return NextResponse.json({ retrying: 0 });

  await db
    .update(schema.listings)
    .set({ status: "PENDING", errorMessage: null })
    .where(and(eq(schema.listings.userId, userId), eq(schema.listings.status, "FAILED")));

  const clerkUser = await currentUser();
  const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;

  const failedIds = failed.map((r) => r.id);
  const batchId = uuidv4();

  let triggerResponse: Response;
  try {
    triggerResponse = await fetch(
      "https://api.trigger.dev/api/v1/tasks/process-batch/trigger",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
        },
        body: JSON.stringify({
          payload: { userId, batchId, mode: "creative", provider: "groq", userEmail },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (err) {
    log.error({ err }, "bulk/retry: network error calling Trigger.dev");
    await db
      .update(schema.listings)
      .set({ status: "FAILED" })
      .where(inArray(schema.listings.id, failedIds));
    return NextResponse.json(
      { error: "No se pudo reiniciar el procesamiento" },
      { status: 503 }
    );
  }

  if (!triggerResponse.ok) {
    const body = await triggerResponse.text().catch(() => "(unreadable)");
    log.error({ status: triggerResponse.status, body }, "bulk/retry: Trigger.dev non-OK response");
    await db
      .update(schema.listings)
      .set({ status: "FAILED" })
      .where(inArray(schema.listings.id, failedIds));
    return NextResponse.json(
      { error: "No se pudo reiniciar el procesamiento" },
      { status: 503 }
    );
  }

  return NextResponse.json({ retrying: failed.length });
}
