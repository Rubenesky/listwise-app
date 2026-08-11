import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { log } from "@/lib/logger";

const AUTO_ITERATE_CREDITS = 4;
const CHARGE_DESCRIPTION = "Auto-optimizar completo";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("charge") }),
  z.object({ action: z.literal("refund"), chargeId: z.string().min(1) }),
]);

// Flat fee for a full runAutoIterate() execution (up to 3 turns of /api/agent/chat,
// each skipping its own per-turn charge via source:"auto_iterate") — see AgentChat.tsx.
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    if (parsed.data.action === "charge") {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const result = await useCredits(userId, AUTO_ITERATE_CREDITS, CHARGE_DESCRIPTION);
      if (!result.success) {
        return NextResponse.json({ error: "Sin créditos suficientes para Auto-optimizar", upsell: true }, { status: 402 });
      }
      log.info({ userId, credits: AUTO_ITERATE_CREDITS, chargeId: result.id }, "Auto-iterate flat charge applied");
      return NextResponse.json({ success: true, remainingCredits: result.remainingCredits, chargeId: result.id });
    }

    // Refund requires proof of the original charge — it must exist, belong to this
    // user, and be a genuine auto-iterate charge. Without this check, any
    // authenticated user could call this endpoint directly and mint free credits.
    // addCredits' stripeRef dedup (keyed on chargeId) additionally stops the same
    // charge from being refunded twice.
    const { chargeId } = parsed.data;
    const [charge] = await db
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.id, chargeId),
          eq(schema.creditTransactions.userId, userId),
          eq(schema.creditTransactions.type, "usage"),
          eq(schema.creditTransactions.description, CHARGE_DESCRIPTION)
        )
      )
      .limit(1);
    if (!charge) {
      return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    }

    await addCredits(userId, AUTO_ITERATE_CREDITS, "refund", "Reembolso por fallo en Auto-optimizar", chargeId);
    log.info({ userId, credits: AUTO_ITERATE_CREDITS, chargeId }, "Auto-iterate flat charge refunded");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "agent/auto-iterate error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
