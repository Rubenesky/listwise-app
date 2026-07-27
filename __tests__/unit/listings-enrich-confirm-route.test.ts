// __tests__/unit/listings-enrich-confirm-route.test.ts
import { POST } from "@/app/api/listings/[id]/enrich/confirm/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn(), addCredits: jest.fn() }));
jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
  getDefaultProvider: jest.fn(() => "gemini"),
}));
jest.mock("@/lib/ai/prompts", () => {
  const actual = jest.requireActual("@/lib/ai/prompts");
  return {
    ...actual,
    buildUserPromptWithVoice: jest.fn(actual.buildUserPromptWithVoice),
  };
});

// Each test's beforeEach queues `.limit()` resolutions in call order:
// (1) the listing select, (2) the source select, (3) the voice-profile
// select (defaults to "no active profile" unless a test overrides it).
const mockListingSelect = jest.fn();
const mockSourceSelect = jest.fn();
const mockUpdate = jest.fn();
const mockSet = jest.fn((_payload: unknown) => ({ where: mockUpdate }));
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockListingSelect }) }),
    })),
    update: () => ({ set: mockSet }),
  },
  schema: { listings: {}, enrichedSources: {}, voiceProfiles: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { getAIResponse, getDefaultProvider } from "@/lib/ai/providers";
import { buildUserPromptWithVoice } from "@/lib/ai/prompts";

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

const BASE_LISTING = {
  id: "listing-1",
  productName: "Persiana",
  category: "Hogar",
  attributes: {},
  generationMode: "creative",
  marketplace: "amazon",
  priceSegment: "premium",
};

const FULL_AI_CONTENT = {
  title: "Persiana X",
  bullets: ["a", "b", "c", "d"],
  description: "desc",
  primary_keyword: "persiana enrollable",
  target_audience: "familias jóvenes",
  hook_type: "benefit",
  quality_flags: { no_trademarks: true, title_in_range: true, bullets_concise: true, attrs_real: true, hook_differentiated: true },
};

describe("POST /api/listings/[id]/enrich/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks() clears call history but NOT queued
    // mockResolvedValueOnce() values — reset explicitly so unconsumed values
    // from a previous test (e.g. tests that return before reaching db.select)
    // don't leak into this test's queue.
    mockListingSelect.mockReset();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockListingSelect
      .mockResolvedValueOnce([BASE_LISTING])
      .mockResolvedValueOnce([{ id: "source-1" }])
      .mockResolvedValueOnce([]); // no active voice profile by default
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 9 });
    (getAIResponse as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(FULL_AI_CONTENT) } }],
    });
    (addCredits as jest.Mock).mockResolvedValue(undefined);
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

  it("passes marketplace, priceSegment, active voice profile, and a non-hardcoded provider into the regeneration call", async () => {
    const voiceProfile = { tone: "cercano", vocabulary: "simple", sentenceStructure: "corta", brandPersonality: "amigable", keyWords: ["hogar"] };
    mockListingSelect.mockReset();
    mockListingSelect
      .mockResolvedValueOnce([BASE_LISTING])
      .mockResolvedValueOnce([{ id: "source-1" }])
      .mockResolvedValueOnce([{ id: "vp-1", profile: voiceProfile, isActive: 1 }]);

    await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());

    expect(getDefaultProvider).toHaveBeenCalled();
    expect(getAIResponse as jest.Mock).toHaveBeenCalledWith(
      expect.any(Array),
      "gemini",
      expect.any(Object)
    );
    expect(buildUserPromptWithVoice as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "Persiana",
        marketplace: "amazon",
        priceSegment: "premium",
      }),
      voiceProfile
    );
  });

  it("passes null voice profile when none is active", async () => {
    await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(buildUserPromptWithVoice as jest.Mock).toHaveBeenCalledWith(expect.any(Object), null);
  });

  it("refreshes primaryKeyword, targetAudience, hookType, qualityFlags and promptVersion on the DB update", async () => {
    await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryKeyword: "persiana enrollable",
        targetAudience: "familias jóvenes",
        hookType: "benefit",
        qualityFlags: FULL_AI_CONTENT.quality_flags,
        promptVersion: "3.0",
        status: "COMPLETED",
      })
    );
  });

  it("refunds the exact credits charged when getAIResponse throws after credits were deducted", async () => {
    (getAIResponse as jest.Mock).mockRejectedValue(new Error("AI provider failed"));
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(res.status).toBe(500);
    expect(addCredits).toHaveBeenCalledWith(
      "user-1",
      1,
      "refund",
      "Reembolso por error al regenerar con fuente enriquecida"
    );
  });

  it("refunds credits when the AI response fails zod validation", async () => {
    (getAIResponse as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"title":"X"}' } }], // missing required "bullets"/"description"
    });
    const res = await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(res.status).toBe(500);
    expect(addCredits).toHaveBeenCalledWith(
      "user-1",
      1,
      "refund",
      "Reembolso por error al regenerar con fuente enriquecida"
    );
  });

  it("does not refund credits when the request fails before credits are charged (insufficient credits)", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    await POST(makeRequest({ sourceId: "source-1", editedSpecs: { material: "aluminio" }, consent: true }), makeParams());
    expect(addCredits).not.toHaveBeenCalled();
  });
});
