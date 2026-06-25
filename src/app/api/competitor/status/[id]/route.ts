import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const [record] = await db
      .select()
      .from(schema.competitorAnalyses)
      .where(
        and(
          eq(schema.competitorAnalyses.id, id),
          eq(schema.competitorAnalyses.userId, userId)
        )
      )
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      id: record.id,
      url: record.url,
      status: record.status,
      scrapedTitle: record.scrapedTitle,
      scrapedDescription: record.scrapedDescription,
      scrapedKeywords: record.scrapedKeywords,
      analysis: record.analysis,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
    });
  } catch (error) {
    console.error("❌ [Competitor Status] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
