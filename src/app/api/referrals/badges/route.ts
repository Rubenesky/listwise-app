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

    const userBadges = await db
      .select()
      .from(schema.badges)
      .where(eq(schema.badges.userId, userId));

    return NextResponse.json({ badges: userBadges });
  } catch {
    return NextResponse.json({ error: "Error al obtener insignias" }, { status: 500 });
  }
}
