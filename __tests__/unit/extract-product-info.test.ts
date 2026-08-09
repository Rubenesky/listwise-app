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

  // Regression test: buildUserPrompt's category-specific lookup tables
  // (EMOTIONAL_ARCHETYPE, REQUIRED_HOOK_TYPE, CATEGORY_CALIBRATION,
  // categoryGuides — all in prompts.ts) are keyed by Title-Case Spanish
  // strings ("Ropa", "Deportes", "Electrónica"...). This prompt used to ask
  // for lowercase categories ("ropa", "deportes"), which silently missed
  // every one of those lookups — including CATEGORY_CALIBRATION's concrete
  // bullet-format example — for every URL/PDF-sourced generation. Confirmed
  // via real staging generations: a CSV-sourced "Deportes" listing scored
  // 73/100 with correctly-formatted bullets; the same product type sourced
  // from a URL (category "deportes") scored 43/100 with no bullet
  // formatting at all.
  it("asks for Title-Case category values matching buildUserPrompt's lookup tables, not lowercase", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent).toContain("Deportes");
    expect(promptSent).not.toMatch(/una de: ropa,/);
  });

  // Regression: extractProductInfoFromText's productName is handed straight
  // to the generation step as "confirmed data" (buildUserPrompt: `Producto:
  // ${product.productName}`), with no trademark-stripping in between. A real
  // generation for an Asics running shoe kept "Asics" in the final title
  // despite the generation prompt's own rule to remove third-party
  // trademarks — because by the time generation ran, the brand was already
  // baked into the "confirmed" product name it was told never to invent
  // beyond. Strip brand names at the source instead of hoping generation
  // overrides its own confirmed-data instruction.
  it("instructs the model to exclude third-party manufacturer/brand names from productName", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto de una página de una zapatilla Asics Novablast");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent.toLowerCase()).toMatch(/marca|fabricante/);
    expect(promptSent.toLowerCase()).toContain("no incluyas");
  });

  // Regression: real staging generation for a near-empty source page (the
  // site's own "Descripción" just repeated the product title, no real
  // specs) still came back with fabricated-sounding attributes ("producción
  // artesanal", "reciclable") not present anywhere in the source text. Once
  // extraction returns any non-empty attributes, buildUserPrompt takes the
  // "usa SOLO estos atributos" branch instead of the "sin atributos
  // confirmados" branch — which already has well-tested sparse-input
  // handling for the CSV path (no material invention, bullets built from
  // context-of-use instead). Extraction inventing plausible attributes from
  // near-nothing skips that proven fallback entirely.
  it("instructs the model to leave attributes empty rather than invent plausible-sounding ones from thin source text", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto");
    const promptSent = mockGetAIResponse.mock.calls[0][0][0].content as string;
    expect(promptSent.toLowerCase()).toMatch(/no inventes/);
    expect(promptSent.toLowerCase()).toMatch(/deja.*vac[íi]o|objeto vac[íi]o|\{\}/);
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

  // Switched from Groq to Gemini: Gemini's API key is on a billed plan, Groq's
  // free-tier daily quota was a real constraint once usage grew.
  it("uses gemini as the AI provider, not groq", async () => {
    mockGetAIResponse.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await extractProductInfoFromText("texto");
    expect(mockGetAIResponse.mock.calls[0][1]).toBe("gemini");
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
