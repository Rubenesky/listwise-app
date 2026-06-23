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

    const subscription = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (subscription.length === 0) {
      return NextResponse.json({ plan: "free", status: "active" });
    }

    return NextResponse.json({
      plan: subscription[0].plan,
      status: subscription[0].status,
    });
  } catch (error) {
    console.error("Error getting user plan:", error);
    return NextResponse.json({ error: "Error al obtener el plan" }, { status: 500 });
  }
}