import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const analyses = await db
      .select({
        id: schema.competitorAnalyses.id,
        url: schema.competitorAnalyses.url,
        status: schema.competitorAnalyses.status,
        scrapedTitle: schema.competitorAnalyses.scrapedTitle,
        createdAt: schema.competitorAnalyses.createdAt,
      })
      .from(schema.competitorAnalyses)
      .where(eq(schema.competitorAnalyses.userId, userId))
      .orderBy(desc(schema.competitorAnalyses.createdAt))
      .limit(20);

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("❌ [Competitor History] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
