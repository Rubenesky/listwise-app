// __tests__/unit/listings-audio-route.test.ts
import { POST } from "@/app/api/listings/[id]/audio/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ratelimitAudioGeneration: { limit: jest.fn() },
}));
jest.mock("@/lib/credits/use-credits", () => ({ useCredits: jest.fn(), addCredits: jest.fn() }));
jest.mock("@/lib/ai/generate-audio-script", () => ({ generateSpokenScript: jest.fn() }));
jest.mock("@/lib/ai/client-gemini-tts", () => ({ generateSpeech: jest.fn() }));

const mockListingSelect = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockListingSelect }) }),
    })),
  },
  schema: { listings: {} },
}));

import { auth } from "@clerk/nextjs/server";
import { ratelimitAudioGeneration } from "@/lib/rate-limit";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { generateSpokenScript } from "@/lib/ai/generate-audio-script";
import { generateSpeech } from "@/lib/ai/client-gemini-tts";

function makeParams(id = "listing-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(): Request {
  return new Request("http://localhost/api/listings/listing-1/audio", { method: "POST" });
}

const BASE_LISTING = {
  id: "listing-1",
  userId: "user-1",
  productName: "Persiana Enrollable",
  generatedTitle: "Persiana Enrollable Premium",
  generatedBullets: ["Bloquea el 99% de la luz", "Fácil instalación"],
  generatedDescription: "Una persiana enrollable resistente y elegante.",
};

describe("POST /api/listings/[id]/audio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListingSelect.mockReset();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitAudioGeneration.limit as jest.Mock).mockResolvedValue({ success: true });
    mockListingSelect.mockResolvedValueOnce([BASE_LISTING]);
    (useCredits as jest.Mock).mockResolvedValue({ success: true, remainingCredits: 8 });
    (generateSpokenScript as jest.Mock).mockResolvedValue("Guion de venta natural.");
    (generateSpeech as jest.Mock).mockResolvedValue({ buffer: Buffer.from("fake-wav-bytes"), mimeType: "audio/wav" });
    (addCredits as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 429 when the daily rate limit is exceeded", async () => {
    (ratelimitAudioGeneration.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(429);
    expect(useCredits).not.toHaveBeenCalled();
  });

  it("returns 404 when the listing does not exist or isn't owned by the caller", async () => {
    mockListingSelect.mockReset();
    mockListingSelect.mockResolvedValueOnce([]);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 when the listing has no generated content yet", async () => {
    mockListingSelect.mockReset();
    mockListingSelect.mockResolvedValueOnce([
      { ...BASE_LISTING, productName: "", generatedTitle: null, generatedBullets: null, generatedDescription: null },
    ]);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(422);
    expect(useCredits).not.toHaveBeenCalled();
  });

  it("returns 402 and does not call the script/TTS pipeline when there are not enough credits", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(402);
    expect(generateSpokenScript).not.toHaveBeenCalled();
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("charges exactly 2 credits and streams back the audio buffer on success", async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(useCredits).toHaveBeenCalledWith("user-1", 2, "Generar audio del listing");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/wav");
    expect(res.headers.get("X-Remaining-Credits")).toBe("8");
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("passes the listing's title, bullets and description into the script generator", async () => {
    await POST(makeRequest(), makeParams());
    expect(generateSpokenScript).toHaveBeenCalledWith({
      title: "Persiana Enrollable Premium",
      bullets: BASE_LISTING.generatedBullets,
      description: BASE_LISTING.generatedDescription,
    });
  });

  it("refunds the exact 2 credits charged when script generation fails after credits were deducted", async () => {
    (generateSpokenScript as jest.Mock).mockRejectedValue(new Error("AI provider failed"));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect(addCredits).toHaveBeenCalledWith("user-1", 2, "refund", "Reembolso por error al generar audio");
  });

  it("refunds the exact 2 credits charged when TTS generation fails after credits were deducted", async () => {
    (generateSpeech as jest.Mock).mockRejectedValue(new Error("Gemini TTS 500"));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect(addCredits).toHaveBeenCalledWith("user-1", 2, "refund", "Reembolso por error al generar audio");
  });

  it("does not refund credits when the request fails before credits are charged (insufficient credits)", async () => {
    (useCredits as jest.Mock).mockResolvedValue({ success: false, remainingCredits: 0 });
    await POST(makeRequest(), makeParams());
    expect(addCredits).not.toHaveBeenCalled();
  });
});
