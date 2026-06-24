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

    const [user] = await db
      .select({ credits: schema.users.credits })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return NextResponse.json({ credits: user?.credits ?? 0 });
  } catch {
    return NextResponse.json({ error: "Error al obtener créditos" }, { status: 500 });
  }
}
