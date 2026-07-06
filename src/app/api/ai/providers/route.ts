import { NextResponse } from "next/server";
import { getAvailableProviders } from "@/lib/ai/providers";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    const available = getAvailableProviders();
    return NextResponse.json({ providers: available });
  } catch (err) {
    log.error({ err }, "ai/providers: getAvailableProviders failed");
    return NextResponse.json({ providers: ["groq"] });
  }
}
