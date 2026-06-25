import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

    const plan = subscription.length > 0 ? subscription[0].plan : "free";

    // Sync plan to Clerk publicMetadata so future loads are instant (no fetch needed)
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      if (user.publicMetadata?.plan !== plan) {
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { ...user.publicMetadata, plan },
        });
      }
    } catch (syncErr) {
      console.warn("⚠️ [Plan] No se pudo sincronizar metadata de Clerk:", syncErr);
    }

    return NextResponse.json({
      plan,
      status: subscription.length > 0 ? subscription[0].status : "active",
    });
  } catch (error) {
    console.error("Error getting user plan:", error);
    return NextResponse.json({ error: "Error al obtener el plan" }, { status: 500 });
  }
}
