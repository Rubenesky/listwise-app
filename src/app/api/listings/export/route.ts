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

    const csvHeader = "productName,generatedTitle,generatedBullets,generatedDescription\n";
    const rows = listings
      .filter((l) => l.status === "COMPLETED")
      .map((l) => {
        const bullets = Array.isArray(l.generatedBullets)
          ? l.generatedBullets.join(" | ")
          : "";
        const title = (l.generatedTitle || "").replace(/"/g, '""');
        const desc = (l.generatedDescription || "").replace(/"/g, '""');
        const name = (l.productName || "").replace(/"/g, '""');
        return `"${name}","${title}","${bullets}","${desc}"`;
      })
      .join("\n");

    const csvContent = csvHeader + rows;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="listwise_export.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
