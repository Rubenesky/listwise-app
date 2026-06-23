import { auth } from "@clerk/nextjs/server";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { validate as validateUuid } from "uuid";
import { db, schema } from "@/db";
import { ratelimit } from "@/lib/rate-limit";
import type { ListingRow } from "@/types";

// id="dashboard" returns the last 100 listings for the authenticated user.
// id=<uuid> returns that specific listing (must belong to the same user).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ListingRow[] | ListingRow | { error: string }>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await ratelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 }
    );
  }

  const { id } = await params;

  if (id === "dashboard") {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.userId, userId))
      .orderBy(desc(schema.listings.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(rows as ListingRow[]);
  }

  if (!validateUuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [listing] = await db
    .select()
    .from(schema.listings)
    .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  return NextResponse.json(listing as ListingRow);
}

// Updates generated content after the user edits it in the modal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await ratelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 }
    );
  }

  const { id } = await params;

  if (!validateUuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await request.json()) as Partial<
    Pick<ListingRow, "generatedTitle" | "generatedBullets" | "generatedDescription">
  >;

  const [existing] = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(and(eq(schema.listings.id, id), eq(schema.listings.userId, userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  await db
    .update(schema.listings)
    .set({
      ...(body.generatedTitle !== undefined && { generatedTitle: body.generatedTitle }),
      ...(body.generatedBullets !== undefined && {
        generatedBullets: body.generatedBullets,
      }),
      ...(body.generatedDescription !== undefined && {
        generatedDescription: body.generatedDescription,
      }),
    })
    .where(eq(schema.listings.id, id));

  return NextResponse.json({ success: true });
}
