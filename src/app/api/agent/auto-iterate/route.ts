import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { log } from "@/lib/logger";

const AUTO_ITERATE_CREDITS = 4;

const bodySchema = z.object({
  action: z.enum(["charge", "refund"]),
});

// Flat fee for a full runAutoIterate() execution (up to 3 turns of /api/agent/chat,
// each skipping its own per-turn charge via source:"auto_iterate") — see AgentChat.tsx.
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    if (parsed.data.action === "charge") {
      const result = await useCredits(userId, AUTO_ITERATE_CREDITS, "Auto-optimizar completo");
      if (!result.success) {
        return NextResponse.json({ error: "Sin créditos suficientes para Auto-optimizar", upsell: true }, { status: 402 });
      }
      log.info({ userId, credits: AUTO_ITERATE_CREDITS }, "Auto-iterate flat charge applied");
      return NextResponse.json({ success: true, remainingCredits: result.remainingCredits });
    }

    await addCredits(userId, AUTO_ITERATE_CREDITS, "refund", "Reembolso por fallo en Auto-optimizar");
    log.info({ userId, credits: AUTO_ITERATE_CREDITS }, "Auto-iterate flat charge refunded");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "agent/auto-iterate error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
