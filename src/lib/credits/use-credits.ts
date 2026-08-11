import { db, schema } from "@/db";
import { eq, sql, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ensureUser } from "@/lib/user/ensure-user";

export interface UseCreditResult {
  success: boolean;
  remainingCredits: number;
  error?: "insufficient" | "user_not_found";
  // id of the creditTransactions row created for this deduction, when one
  // happened — callers that may need to prove/reference this specific charge
  // later (e.g. to verify a refund request) can hold onto it.
  id?: string;
}

/**
 * Atomically deducts agentCredits and logs the transaction.
 * Free users are blocked (success:false, no deduction) when their balance is
 * insufficient. Pro/Enterprise users are deducted too (floored at 0) but are
 * never blocked — they always get success:true, even at zero credits.
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
  const current = user.agentCredits ?? 0;

  // Free users: block if insufficient credits
  if (plan === "free" && current < amount) {
    return { success: false, remainingCredits: current, error: "insufficient" };
  }

  // Deduct for all plans — free can go to zero (already blocked above), pro/enterprise floored at 0
  const deductExpr = plan === "free"
    ? sql`agent_credits - ${amount}`
    : sql`max(0, agent_credits - ${amount})`;

  const transactionId = uuidv4();
  await db.transaction(async (tx) => {
    await tx.update(schema.users)
      .set({ agentCredits: deductExpr })
      .where(eq(schema.users.id, userId));
    await tx.insert(schema.creditTransactions).values({
      id: transactionId,
      userId,
      amount: -amount,
      type: "usage",
      description,
      stripeRef: null,
      createdAt: Math.floor(Date.now() / 1000),
    });
  });

  return { success: true, remainingCredits: Math.max(0, current - amount), id: transactionId };
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "bonus" | "refund",
  description: string,
  stripeRef?: string
): Promise<void> {
  await ensureUser(userId);

  // Defense-in-depth: a Stripe event can be delivered to more than one webhook
  // endpoint (e.g. staging + production both registered), each processing it
  // independently. Skip if this exact reference was already credited.
  if (stripeRef) {
    const [existing] = await db
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.userId, userId),
          eq(schema.creditTransactions.stripeRef, stripeRef)
        )
      )
      .limit(1);
    if (existing) return;
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.users)
      .set({ agentCredits: sql`agent_credits + ${amount}` })
      .where(eq(schema.users.id, userId));
    await tx.insert(schema.creditTransactions).values({
      id: uuidv4(),
      userId,
      amount,
      type,
      description,
      stripeRef: stripeRef ?? null,
      createdAt: Math.floor(Date.now() / 1000),
    });
  });
}
