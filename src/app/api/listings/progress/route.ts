import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const listings = await db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.userId, userId));

    const total = listings.length;
    const processed = listings.filter(
      (l) => l.status === "COMPLETED" || l.status === "FAILED"
    ).length;
    const pending = listings.filter(
      (l) => l.status === "PENDING" || l.status === "PROCESSING"
    ).length;

    return NextResponse.json({
      total,
      processed,
      pending,
      progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      status: pending === 0 ? "complete" : "processing",
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener progreso" }, { status: 500 });
  }
}
