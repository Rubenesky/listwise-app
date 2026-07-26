// __tests__/unit/listings-enrich-confirm-route.test.ts
import { POST } from "@/app/api/listings/[id]/enrich/confirm/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn() }));
jest.mock("@/lib/ai/providers", () => ({ getAIResponse: jest.fn() }));

const mockListingSelect = jest.fn();
const mockSourceSelect = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockListingSelect }) }),
    })),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  },
  schema: { listings: {}, enrichedSources: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { useCredits } from "@/lib/credits/use-credits";
import { getAIResponse } from "@/lib/ai/providers";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/listings/listing-1/enrich/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "listing-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/listings/[id]/enrich/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockListingSelect
      .mockResolvedValueOnce([{ id: "listing-1", productName: "Persiana", category: "Hogar", attributes: {}, generationMode: "creative" }])
      .mockResolvedValueOnce([{ id: "source-1" }]);
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 9 });
    (getAIResponse as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"title":"Persiana X","bullets":["a","b","c","d"],"description":"desc"}' } }],
    });
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ sourceId: "s", editedSpecs: {}, consent: true }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 when consent is not exactly true", async () => {
    const res = await POST(makeRequest({ sourceId: "s", editedSpecs: {}, consent: false }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 402 when there are not enough credits", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(res.status).toBe(402);
  });

  it("charges credits and regenerates the listing on success", async () => {
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.remainingCredits).toBe(9);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
