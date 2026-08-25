import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

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

    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      if (user.publicMetadata?.plan !== plan) {
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { ...user.publicMetadata, plan },
        });
      }
    } catch (syncErr) {
      log.warn({ err: syncErr, userId }, "user/plan: Clerk metadata sync failed");
    }

    return NextResponse.json({
      plan,
      status: subscription.length > 0 ? subscription[0].status : "active",
      cancelAtPeriodEnd: subscription.length > 0 ? !!subscription[0].cancelAtPeriodEnd : false,
      currentPeriodEnd: subscription.length > 0 ? subscription[0].currentPeriodEnd : null,
    });
  } catch (error) {
    log.error({ err: error }, "user/plan error");
    return NextResponse.json({ error: "Error al obtener el plan" }, { status: 500 });
  }
}
