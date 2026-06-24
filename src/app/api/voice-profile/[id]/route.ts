import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    await db
      .delete(schema.voiceProfiles)
      .where(and(eq(schema.voiceProfiles.id, id), eq(schema.voiceProfiles.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[voice-profile DELETE]", error);
    return NextResponse.json({ error: "Error al eliminar el perfil" }, { status: 500 });
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const [profile] = await db
      .select({ id: schema.voiceProfiles.id, isActive: schema.voiceProfiles.isActive })
      .from(schema.voiceProfiles)
      .where(and(eq(schema.voiceProfiles.id, id), eq(schema.voiceProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    if (profile.isActive) {
      await db
        .update(schema.voiceProfiles)
        .set({ isActive: 0 })
        .where(eq(schema.voiceProfiles.id, id));
      return NextResponse.json({ success: true, isActive: false });
    } else {
      // Deactivate all, then activate only this one
      await db
        .update(schema.voiceProfiles)
        .set({ isActive: 0 })
        .where(eq(schema.voiceProfiles.userId, userId));
      await db
        .update(schema.voiceProfiles)
        .set({ isActive: 1 })
        .where(eq(schema.voiceProfiles.id, id));
      return NextResponse.json({ success: true, isActive: true });
    }
  } catch (error) {
    console.error("[voice-profile PATCH]", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
