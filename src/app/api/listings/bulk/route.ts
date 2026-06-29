import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db, schema } from "@/db";

export async function DELETE(): Promise<NextResponse<{ deleted: number } | { error: string }>> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const failed = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(and(eq(schema.listings.userId, userId), eq(schema.listings.status, "FAILED")));

  if (failed.length === 0) return NextResponse.json({ deleted: 0 });

  for (const { id } of failed) {
    await db.delete(schema.listings).where(eq(schema.listings.id, id));
  }

  return NextResponse.json({ deleted: failed.length });
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

  const batchId = uuidv4();
  await fetch("https://api.trigger.dev/api/v1/tasks/process-batch/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
    },
    body: JSON.stringify({
      payload: { userId, batchId, mode: "creative", provider: "groq", userEmail },
    }),
  });

  return NextResponse.json({ retrying: failed.length });
}
