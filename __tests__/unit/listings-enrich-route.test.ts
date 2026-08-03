// __tests__/unit/listings-enrich-route.test.ts
import { POST, GET } from "@/app/api/listings/[id]/enrich/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ratelimitEnrichedInput: { limit: jest.fn() },
}));
jest.mock("@/lib/pdf/extract-text", () => ({ extractTextFromPdf: jest.fn() }));
jest.mock("@/lib/text/detect-language", () => ({ detectLanguageMismatch: jest.fn().mockReturnValue(false) }));
jest.mock("@/lib/ai/extract-specs", () => ({ extractSpecsFromText: jest.fn() }));

const mockListingSelect = jest.fn();
const mockSourceInsert = jest.fn();
// `where()` supports both call shapes used by the route: the listings query
// does `.where().limit()`, while the enrichedSources cached-source query does
// `.where().orderBy().limit()`. Exposing `where`/`orderBy` as jest.fn()s lets
// tests assert on the exact conditions/ordering passed to the query builder.
const mockOrderBy = jest.fn((_orderBy?: unknown) => ({ limit: mockListingSelect }));
const mockWhere = jest.fn((_condition?: unknown) => ({ limit: mockListingSelect, orderBy: mockOrderBy }));
jest.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockWhere }) }),
    insert: () => ({ values: mockSourceInsert }),
  },
  schema: { listings: {}, enrichedSources: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { eq, and, gt, desc } from "drizzle-orm";
import { schema } from "@/db";

function makeRequest(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return new Request("http://localhost/api/listings/listing-1/enrich", { method: "POST", body: fd });
}

function makeGetRequest(): Request {
  return new Request("http://localhost/api/listings/listing-1/enrich", { method: "GET" });
}

function makeParams(id = "listing-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/listings/[id]/enrich", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: true });
    mockListingSelect.mockResolvedValue([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }]);
    mockSourceInsert.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 400 for a non-PDF file", async () => {
    const res = await POST(makeRequest(new File(["x"], "f.png", { type: "image/png" })), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 422 with scannedPdf flag when the PDF has no extractable text", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: false, text: "", numPages: 2 });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.scannedPdf).toBe(true);
    expect(body.error).toContain("imagen escaneada");
  });

  it("returns merged specs and conflicts on success", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: true, text: "texto del pdf", numPages: 1 });
    (extractSpecsFromText as jest.Mock).mockResolvedValue({ material: "aluminio", color: "gris" });
    const res = await POST(makeRequest(new File(["x"], "f.pdf", { type: "application/pdf" })), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.extractedSpecs).toEqual({ material: "aluminio", color: "blanco" });
    expect(body.conflicts).toEqual([{ key: "color", manualValue: "blanco", extractedValue: "gris" }]);
    expect(mockSourceInsert).toHaveBeenCalled();
  });
});

describe("GET /api/listings/[id]/enrich (cached-source lookup)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: true });
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
    expect(ratelimitEnrichedInput.limit).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded, only after a cached source is found, and never calls the LLM", async () => {
    // A cached source WAS found — this is the only branch that reaches the
    // rate limiter now, since it's the only branch that would go on to call
    // extractSpecsFromText.
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
      .mockResolvedValueOnce([{ id: "source-1", extractedText: "aluminio 120x80" }]);
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: false });

    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error).toContain("Límite diario");
    // The listing lookup and cached-source lookup DO happen (they run before
    // the rate limiter now), but the LLM call must still be skipped.
    expect(mockListingSelect).toHaveBeenCalledTimes(2);
    expect(extractSpecsFromText).not.toHaveBeenCalled();
  });

  it("returns found=false when there is no cached source, without ever touching the rate limiter", async () => {
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
      .mockResolvedValueOnce([]);
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.found).toBe(false);
    // No LLM call happens on this path either, so the rate limiter — which
    // only meters the branch that's about to call extractSpecsFromText —
    // must never be invoked here.
    expect(ratelimitEnrichedInput.limit).not.toHaveBeenCalled();
    expect(extractSpecsFromText).not.toHaveBeenCalled();
  });

  it("returns found=true with re-merged specs when a non-expired COMPLETED source exists", async () => {
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
      .mockResolvedValueOnce([{ id: "source-1", extractedText: "aluminio 120x80" }]);
    (extractSpecsFromText as jest.Mock).mockResolvedValue({ material: "aluminio" });
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.sourceId).toBe("source-1");
    expect(body.extractedSpecs).toEqual({ material: "aluminio", color: "blanco" });
  });

  it("filters the cached-source query to sourceType 'pdf' and orders by most-recent createdAt descending", async () => {
    // Fix Date.now() so the `gt(cacheExpiresAt, now)` condition we reconstruct
    // below is byte-identical to the one the route builds internally.
    const fixedNowMs = 1_700_000_000_000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNowMs);

    try {
      mockListingSelect
        .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", attributes: { color: "blanco" } }])
        .mockResolvedValueOnce([{ id: "source-1", extractedText: "aluminio 120x80" }]);
      (extractSpecsFromText as jest.Mock).mockResolvedValue({ material: "aluminio" });

      await GET(makeGetRequest(), makeParams());

      // First `.where(...)` call is the listings lookup, second is the
      // enrichedSources cached-source lookup — assert on the second.
      expect(mockWhere).toHaveBeenCalledTimes(2);
      const actualSourceCondition = mockWhere.mock.calls[1][0];
      const expectedNowSeconds = Math.floor(fixedNowMs / 1000);
      const expectedSourceCondition = and(
        eq(schema.enrichedSources.listingId, "listing-1"),
        eq(schema.enrichedSources.userId, "user-1"),
        eq(schema.enrichedSources.status, "COMPLETED"),
        eq(schema.enrichedSources.sourceType, "pdf"),
        gt(schema.enrichedSources.cacheExpiresAt, expectedNowSeconds)
      );
      // Structural equality against a condition tree built the same way the
      // route builds it — this fails if the sourceType filter is dropped,
      // reordered, or the wrong column/value is used.
      expect(actualSourceCondition).toEqual(expectedSourceCondition);

      // `.orderBy(...)` must be called exactly once, with createdAt descending,
      // so the most-recent matching source wins when multiple rows qualify.
      expect(mockOrderBy).toHaveBeenCalledTimes(1);
      expect(mockOrderBy).toHaveBeenCalledWith(desc(schema.enrichedSources.createdAt));
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
