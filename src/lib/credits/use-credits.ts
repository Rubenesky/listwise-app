import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ensureUser } from "@/lib/user/ensure-user";

export interface UseCreditResult {
  success: boolean;
  remainingCredits: number;
  error?: "insufficient" | "user_not_found";
}

/**
 * Atomically deducts agentCredits from a free user and logs the transaction.
 * Pro/Enterprise users are never deducted — they return success immediately.
 */
export async function useCredits(
  userId: string,
  amount: number,
  description: string
): Promise<UseCreditResult> {
  await ensureUser(userId);

  const [user] = await db
    .select({ agentCredits: schema.users.agentCredits, agentPlan: schema.users.agentPlan })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return { success: false, remainingCredits: 0, error: "user_not_found" };

  const plan = user.agentPlan ?? "free";

  if (plan !== "free") {
    await logTransaction(userId, -amount, "usage", description);
    return { success: true, remainingCredits: -1 };
  }

  const current = user.agentCredits ?? 0;
  if (current < amount) return { success: false, remainingCredits: current, error: "insufficient" };

  await db.update(schema.users)
    .set({ agentCredits: sql`agent_credits - ${amount}` })
    .where(eq(schema.users.id, userId));

  await logTransaction(userId, -amount, "usage", description);

  return { success: true, remainingCredits: current - amount };
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "bonus" | "refund",
  description: string,
  stripeRef?: string
): Promise<void> {
  await ensureUser(userId);
  await db.update(schema.users)
    .set({ agentCredits: sql`agent_credits + ${amount}` })
    .where(eq(schema.users.id, userId));

  await logTransaction(userId, amount, type, description, stripeRef);
}

async function logTransaction(
  userId: string,
  amount: number,
  type: string,
  description: string,
  stripeRef?: string
): Promise<void> {
  await db.insert(schema.creditTransactions).values({
    id: uuidv4(),
    userId,
    amount,
    type,
    description,
    stripeRef: stripeRef ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}
