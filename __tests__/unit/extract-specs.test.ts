// __tests__/unit/extract-specs.test.ts
import { extractSpecsFromText } from "@/lib/ai/extract-specs";
import { getAIResponse } from "@/lib/ai/providers";

jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
}));
const mockGetAIResponse = getAIResponse as jest.Mock;

describe("extractSpecsFromText", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid JSON response into a flat string record", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: '{"material": "aluminio", "medidas": "120x80cm"}' } }],
    });
    const result = await extractSpecsFromText("texto largo del pdf", "Persiana", false);
    expect(result).toEqual({ material: "aluminio", medidas: "120x80cm" });
  });

  it("drops non-string values from the parsed JSON", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: '{"material": "aluminio", "peso": 5, "vacio": ""}' } }],
    });
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({ material: "aluminio" });
  });

  it("returns {} (non-blocking) when the AI call throws", async () => {
    mockGetAIResponse.mockRejectedValue(new Error("groq down"));
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({});
  });

  it("returns {} when the response has no parseable JSON", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "no json here" } }] });
    const result = await extractSpecsFromText("texto", "Producto", false);
    expect(result).toEqual({});
  });

  it("includes a translation instruction in the prompt when translateToSpanish is true", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractSpecsFromText("some english text", "Producto", true);
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent).toContain("traduce");
  });

  // Switched from Groq to Gemini: Gemini's API key is on a billed plan, Groq's
  // free-tier daily quota was a real constraint once usage grew.
  it("uses gemini as the AI provider, not groq", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractSpecsFromText("texto", "Producto", false);
    expect(mockGetAIResponse.mock.calls[0][1]).toBe("gemini");
  });
});
