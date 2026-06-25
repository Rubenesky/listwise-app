import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get("listingId");
    if (!listingId) return NextResponse.json({ error: "listingId requerido" }, { status: 400 });

    const [conv] = await db
      .select()
      .from(schema.agentConversations)
      .where(
        and(
          eq(schema.agentConversations.listingId, listingId),
          eq(schema.agentConversations.userId, userId)
        )
      )
      .orderBy(desc(schema.agentConversations.updatedAt))
      .limit(1);

    if (!conv) return NextResponse.json({ conversation: null });

    return NextResponse.json({
      conversation: {
        id: conv.id,
        messages: conv.messages,
        updatedAt: conv.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ [Agent Conversation] Error:", error);
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}
