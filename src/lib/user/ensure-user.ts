import { db, schema } from "@/db";

/**
 * Upsert a user row with free-tier defaults.
 * Safe to call on every API request — INSERT OR IGNORE is a no-op when the row exists.
 */
export async function ensureUser(userId: string): Promise<void> {
  await db.insert(schema.users)
    .values({ id: userId, agentCredits: 10, agentPlan: "free", credits: 0 })
    .onConflictDoNothing();
}
