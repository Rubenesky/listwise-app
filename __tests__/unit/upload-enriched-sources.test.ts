// __tests__/unit/upload-enriched-sources.test.ts
// Focused unit test for the CSV-row -> enrichedSources row-building logic,
// extracted as a pure function so it's testable without mocking the whole
// Next.js route (db insert, credits, Trigger.dev fetch, etc.).
import { buildEnrichedSourceRows } from "@/lib/csv/build-enriched-sources";
import { validateUrlSSRF } from "@/lib/security/ssrf";

jest.mock("@/lib/security/ssrf", () => ({ validateUrlSSRF: jest.fn() }));
const mockValidate = validateUrlSSRF as jest.Mock;

describe("buildEnrichedSourceRows", () => {
  beforeEach(() => jest.clearAllMocks());

  it("skips rows without a sourceUrl", async () => {
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toEqual([]);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("skips a row when the rate limit check fails for that row", async () => {
    mockValidate.mockResolvedValue({ ok: true, normalized: "https://example.com/a" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "https://example.com/a" }],
      ["listing-1"],
      "user-1",
      async () => false
    );
    expect(rows).toEqual([]);
  });

  it("skips a row when SSRF validation fails", async () => {
    mockValidate.mockResolvedValue({ ok: false, error: "blocked" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "http://169.254.169.254/" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toEqual([]);
  });

  it("creates a PENDING enrichedSources row for a valid sourceUrl", async () => {
    mockValidate.mockResolvedValue({ ok: true, normalized: "https://proveedor.com/ficha" });
    const rows = await buildEnrichedSourceRows(
      [{ productName: "A", sourceUrl: "https://proveedor.com/ficha" }],
      ["listing-1"],
      "user-1",
      async () => true
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "user-1",
      listingId: "listing-1",
      sourceType: "url",
      sourceRef: "https://proveedor.com/ficha",
      status: "PENDING",
    });
  });
});
