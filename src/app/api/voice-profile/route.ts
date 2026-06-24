import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const profiles = await db
      .select()
      .from(schema.voiceProfiles)
      .where(eq(schema.voiceProfiles.userId, userId))
      .orderBy(schema.voiceProfiles.createdAt);

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("[voice-profile GET]", error);
    return NextResponse.json({ error: "Error al obtener perfiles" }, { status: 500 });
  }
}
