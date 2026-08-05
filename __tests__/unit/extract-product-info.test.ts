import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";
import { getAIResponse } from "@/lib/ai/providers";

jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
}));
const mockGetAIResponse = getAIResponse as jest.Mock;

describe("extractProductInfoFromText", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid JSON response into a ProductInfo object", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Persiana Veneciana Aluminio 25mm",
            category: "hogar",
            attributes: { material: "aluminio", medidas: "120x180cm" },
            primaryKeyword: "persiana veneciana aluminio",
            confidence: 0.85,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto largo scrapeado de la página");
    expect(result).toEqual({
      productName: "Persiana Veneciana Aluminio 25mm",
      category: "hogar",
      attributes: { material: "aluminio", medidas: "120x180cm" },
      primaryKeyword: "persiana veneciana aluminio",
      confidence: 0.85,
    });
  });

  it("returns null (not throws, not {}) when the AI call rejects", async () => {
    mockGetAIResponse.mockRejectedValue(new Error("groq down"));
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("returns null when the response has no parseable JSON", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "no json here" } }] });
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("returns null when required fields are missing from the parsed JSON", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ productName: "" , category: "hogar" }) } }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(result).toBeNull();
  });

  it("clamps confidence to the [0,1] range if the model returns an out-of-range value", async () => {
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Producto X",
            category: "hogar",
            attributes: {},
            primaryKeyword: "producto x",
            confidence: 1.4,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(result?.confidence).toBe(1);
  });

  it("includes anti-noise instruction in the prompt about identifying the main product", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto de una página con productos relacionados");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent.toLowerCase()).toContain("producto principal");
  });

  it("instructs the model to pick the first specifically-named product on a category/listing page instead of synthesizing a generic one", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto de una página de categoría con varios productos listados");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent.toLowerCase()).toContain("primer producto");
    expect(promptSent.toLowerCase()).toContain("no inventes");
  });

  it("keeps only the first 20 attribute keys when the model returns more than 20", async () => {
    const tooManyAttrs: Record<string, string> = {};
    for (let i = 0; i < 30; i++) {
      tooManyAttrs[`key${i}`] = `value${i}`;
    }
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Producto X",
            category: "hogar",
            attributes: tooManyAttrs,
            primaryKeyword: "producto x",
            confidence: 0.5,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(Object.keys(result?.attributes ?? {})).toHaveLength(20);
    expect(result?.attributes.key0).toBe("value0");
    expect(result?.attributes.key19).toBe("value19");
    expect(result?.attributes.key20).toBeUndefined();
  });

  it("truncates an oversized attribute value to 200 chars", async () => {
    const longValue = "a".repeat(250);
    mockGetAIResponse.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            productName: "Producto X",
            category: "hogar",
            attributes: { material: longValue },
            primaryKeyword: "producto x",
            confidence: 0.5,
          }),
        },
      }],
    });
    const result = await extractProductInfoFromText("texto");
    expect(result?.attributes.material).toHaveLength(200);
    expect(result?.attributes.material).toBe("a".repeat(200));
  });
});
