import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Returns a 403 NextResponse if the caller is not the admin user, null otherwise.
 * Usage: const denied = await requireAdmin(); if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID ?? "";
  if (!userId || !adminId || userId !== adminId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}

/**
 * Returns true if the current session belongs to the admin user.
 * For use in Server Components (pages, layouts).
 */
export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_USER_ID ?? "";
  return Boolean(userId && adminId && userId === adminId);
}
