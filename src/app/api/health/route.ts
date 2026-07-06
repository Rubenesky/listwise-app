import { NextResponse } from "next/server";
import { db } from "@/db";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    await db.$client.execute("SELECT 1");
    return NextResponse.json({
      status: "ok",
      db: "ok",
      timestamp: new Date().toISOString(),
      service: "listwise-app",
    });
  } catch (err) {
    log.error({ err }, "Health check: DB unreachable");
    return NextResponse.json(
      { status: "error", db: "error", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
