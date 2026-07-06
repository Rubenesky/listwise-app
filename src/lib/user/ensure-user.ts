import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Upsert a user row with free-tier defaults, then return the row.
 * Safe to call on every API request — INSERT OR IGNORE is a no-op when the row exists.
 * Returns the user row so callers avoid a redundant SELECT after this call.
 */
export async function ensureUser(userId: string) {
  await db.insert(schema.users)
    .values({ id: userId, agentCredits: 20, agentPlan: "free", credits: 0 })
    .onConflictDoNothing();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return user;
}
