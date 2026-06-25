import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { desc, inArray } from "drizzle-orm";

const ADMIN_USER_IDS = ["user_3FKeQMYvlFqlnt1QqG8pURl1ARl"];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const analytics = await db
      .select()
      .from(schema.agentAnalytics)
      .orderBy(desc(schema.agentAnalytics.createdAt))
      .limit(1000);

    const total = analytics.length;
    const accepted = analytics.filter((a) => a.accepted === 1).length;
    const commands: Record<string, number> = {};
    const products: Record<string, number> = {};
    let totalLatency = 0;

    for (const item of analytics) {
      if (item.command) commands[item.command] = (commands[item.command] ?? 0) + 1;
      if (item.listingId) products[item.listingId] = (products[item.listingId] ?? 0) + 1;
      totalLatency += item.latency ?? 0;
    }

    const avgLatency = total > 0 ? totalLatency / total : 0;

    const sortedCommands = Object.entries(commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const sortedProducts = Object.entries(products)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Fetch product names for all top products at once (spec bug fix: was only fetching first)
    const productIds = sortedProducts.map((p) => p[0]);
    const productNames: Record<string, string> = {};
    if (productIds.length > 0) {
      const listings = await db
        .select({ id: schema.listings.id, productName: schema.listings.productName })
        .from(schema.listings)
        .where(inArray(schema.listings.id, productIds));
      for (const l of listings) productNames[l.id] = l.productName;
    }

    // Aggregate evolution by date
    const evolutionMap: Record<string, number> = {};
    for (const item of analytics) {
      const date = new Date((item.createdAt ?? 0) * 1000).toISOString().split("T")[0];
      evolutionMap[date] = (evolutionMap[date] ?? 0) + 1;
    }
    const evolution = Object.entries(evolutionMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    console.log(`📊 [Admin Analytics] ${total} consultas, ${Object.keys(commands).length} comandos únicos`);

    return NextResponse.json({
      total,
      accepted,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      avgLatency,
      commands: sortedCommands.map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
      products: sortedProducts.map(([id, count]) => ({
        id,
        name: productNames[id] ?? "Desconocido",
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })),
      evolution,
    });
  } catch (error) {
    console.error("❌ [Admin Analytics] Error:", error);
    return NextResponse.json({ error: "Error al obtener analítica" }, { status: 500 });
  }
}
