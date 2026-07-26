import { v4 as uuidv4 } from "uuid";
import { validateUrlSSRF } from "@/lib/security/ssrf";

export interface EnrichedSourceInsertRow {
  id: string;
  userId: string;
  listingId: string;
  sourceType: "url";
  sourceRef: string;
  status: "PENDING";
  extractedText: null;
  errorMessage: null;
  cacheExpiresAt: number;
  createdAt: number;
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Extracted as a pure function (no db import) so it's unit-testable without
// mocking Drizzle — the upload route calls this, then inserts the result.
export async function buildEnrichedSourceRows(
  records: ({ sourceUrl?: string } & Record<string, unknown>)[],
  listingIds: string[],
  userId: string,
  checkRateLimit: () => Promise<boolean>
): Promise<EnrichedSourceInsertRow[]> {
  const rows: EnrichedSourceInsertRow[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < records.length; i++) {
    const rawUrl = records[i].sourceUrl?.trim();
    if (!rawUrl) continue;

    const allowed = await checkRateLimit();
    if (!allowed) continue; // fallback no bloqueante: fila se genera sin fuente

    const check = await validateUrlSSRF(rawUrl);
    if (!check.ok) continue;

    rows.push({
      id: uuidv4(),
      userId,
      listingId: listingIds[i],
      sourceType: "url",
      sourceRef: check.normalized!,
      status: "PENDING",
      extractedText: null,
      errorMessage: null,
      cacheExpiresAt: now + THIRTY_DAYS_SECONDS,
      createdAt: now,
    });
  }

  return rows;
}
