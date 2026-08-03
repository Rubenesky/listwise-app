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

export interface BuildEnrichedSourceRowsResult {
  rows: EnrichedSourceInsertRow[];
  warnings: string[];
}

// Extracted as a pure function (no db import) so it's unit-testable without
// mocking Drizzle — the upload route calls this, then inserts the result.
export async function buildEnrichedSourceRows(
  records: ({ sourceUrl?: string } & Record<string, unknown>)[],
  listingIds: string[],
  userId: string,
  checkRateLimit: () => Promise<boolean>
): Promise<BuildEnrichedSourceRowsResult> {
  const rows: EnrichedSourceInsertRow[] = [];
  const warnings: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < records.length; i++) {
    const rawUrl = records[i].sourceUrl?.trim();
    if (!rawUrl) continue;

    const row = i + 2;

    // Validate the URL before spending rate-limit quota, so malformed or
    // SSRF-blocked URLs never consume one of the user's daily slots.
    const check = await validateUrlSSRF(rawUrl);
    if (!check.ok) {
      warnings.push(
        `Fila ${row}: ${check.error} — el producto se generará sin la fuente indicada`
      );
      continue;
    }

    const allowed = await checkRateLimit();
    if (!allowed) {
      // fallback no bloqueante: fila se genera sin fuente
      warnings.push(
        `Fila ${row}: límite diario de fuentes enriquecidas alcanzado — el producto se generará sin la fuente indicada`
      );
      continue;
    }

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

  return { rows, warnings };
}
