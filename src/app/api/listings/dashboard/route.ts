import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, desc, count, and, inArray } from "drizzle-orm";
import { log } from "@/lib/logger";
import { computeStatusStats } from "@/lib/listings/status-stats";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [listings, [totalResult], statusRows] = await Promise.all([
      db
        .select({
          id: schema.listings.id,
          productName: schema.listings.productName,
          category: schema.listings.category,
          status: schema.listings.status,
          generationMode: schema.listings.generationMode,
          generatedTitle: schema.listings.generatedTitle,
          generatedTitleB: schema.listings.generatedTitleB,
          generatedBullets: schema.listings.generatedBullets,
          generatedDescription: schema.listings.generatedDescription,
          errorMessage: schema.listings.errorMessage,
          userRating: schema.listings.userRating,
          primaryKeyword: schema.listings.primaryKeyword,
          hookType: schema.listings.hookType,
          qualityFlags: schema.listings.qualityFlags,
          attributes: schema.listings.attributes,
        })
        .from(schema.listings)
        .where(eq(schema.listings.userId, userId))
        .orderBy(desc(schema.listings.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(schema.listings)
        .where(eq(schema.listings.userId, userId)),

      // Aggregate status counts across ALL of the user's listings, not just
      // this page — the dashboard's Completados/Pendientes/Fallidos cards
      // need the true total, not a count over the ≤20 rows on screen.
      db
        .select({ status: schema.listings.status, count: count() })
        .from(schema.listings)
        .where(eq(schema.listings.userId, userId))
        .groupBy(schema.listings.status),
    ]);

    const total = totalResult?.count ?? 0;
    const stats = computeStatusStats(statusRows);

    // Batch-fetch CSV sourceUrl enrichment status for this page's listings in
    // ONE query (mirrors the inArray + Map pattern in
    // src/trigger/jobs/process-products.ts's enriched-source lookup).
    const listingIds = listings.map((l) => l.id);
    const enrichmentByListingId = new Map<string, { status: string; errorMessage: string | null }>();
    if (listingIds.length > 0) {
      const enrichmentRows = await db
        .select({
          listingId: schema.enrichedSources.listingId,
          status: schema.enrichedSources.status,
          errorMessage: schema.enrichedSources.errorMessage,
        })
        .from(schema.enrichedSources)
        .where(
          and(
            inArray(schema.enrichedSources.listingId, listingIds),
            eq(schema.enrichedSources.sourceType, "url")
          )
        );
      for (const row of enrichmentRows) {
        if (row.listingId) {
          enrichmentByListingId.set(row.listingId, { status: row.status, errorMessage: row.errorMessage });
        }
      }
    }

    const listingsWithEnrichment = listings.map((listing) => {
      const enrichment = enrichmentByListingId.get(listing.id);
      return {
        ...listing,
        enrichmentStatus: enrichment?.status ?? null,
        enrichmentError: enrichment?.errorMessage ?? null,
      };
    });

    return NextResponse.json({
      listings: listingsWithEnrichment,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        stats,
      },
    });
  } catch (error) {
    log.error({ err: error }, "listings/dashboard error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
