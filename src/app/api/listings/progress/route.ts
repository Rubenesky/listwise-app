import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { count, eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const rows = await db
      .select({
        status: schema.listings.status,
        n: count(),
      })
      .from(schema.listings)
      .where(eq(schema.listings.userId, userId))
      .groupBy(schema.listings.status);

    const countByStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));

    const processed =
      (countByStatus["COMPLETED"] ?? 0) + (countByStatus["FAILED"] ?? 0);
    const pending =
      (countByStatus["PENDING"] ?? 0) + (countByStatus["PROCESSING"] ?? 0);
    const total = rows.reduce((sum, r) => sum + r.n, 0);

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
