import { NextResponse } from "next/server";
import { getAvailableProviders } from "@/lib/ai/providers";

export async function GET() {
  try {
    const available = getAvailableProviders();
    return NextResponse.json({ providers: available });
  } catch (err) {
    console.error("[ai/providers] getAvailableProviders failed:", err);
    return NextResponse.json({ providers: ["groq"] });
  }
}
