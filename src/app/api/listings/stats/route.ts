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
    const completed = listings.filter((l) => l.status === "COMPLETED").length;
    const pending = listings.filter(
      (l) => l.status === "PENDING" || l.status === "PROCESSING"
    ).length;
    const failed = listings.filter((l) => l.status === "FAILED").length;

    return NextResponse.json({ total, completed, pending, failed });
  } catch {
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
