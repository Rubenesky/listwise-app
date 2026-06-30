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

    const listings = await db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.userId, userId));

    const completed = listings.filter((l) => l.status === "COMPLETED");
    if (completed.length === 0) {
      return NextResponse.json(
        { error: "No hay productos completados para exportar." },
        { status: 404 }
      );
    }

    const q = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;

    const csvHeader = "product_name,generated_title,bullet_point_1,bullet_point_2,bullet_point_3,bullet_point_4,bullet_point_5,description\n";
    const rows = completed
      .map((l) => {
        const raw = Array.isArray(l.generatedBullets) ? l.generatedBullets : [];
        const b = Array.from({ length: 5 }, (_, i) => q(raw[i] ?? ""));
        return [
          q(l.productName ?? ""),
          q(l.generatedTitle ?? ""),
          ...b,
          q(l.generatedDescription ?? ""),
        ].join(",");
      })
      .join("\n");

    const csvContent = csvHeader + rows;
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="listwise_export_${date}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
