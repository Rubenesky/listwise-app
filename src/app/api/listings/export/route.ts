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

    const csvHeader = "productName,generatedTitle,generatedBullets,generatedDescription\n";
    const rows = completed
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
