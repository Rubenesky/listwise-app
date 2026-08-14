import { generateSpokenScript } from "@/lib/ai/generate-audio-script";

jest.mock("@/lib/ai/providers", () => ({
  getAIResponse: jest.fn(),
  getDefaultProvider: jest.fn(() => "gemini"),
}));

import { getAIResponse } from "@/lib/ai/providers";

function mockScript(content: string | null) {
  (getAIResponse as jest.Mock).mockResolvedValue({ choices: [{ message: { content } }] });
}

describe("generateSpokenScript", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when the AI returns no content", async () => {
    mockScript(null);
    await expect(
      generateSpokenScript({ title: "T", bullets: ["a"], description: "d" })
    ).rejects.toThrow();
  });

  it("substitutes title/bullets/description into the prompt sent to the AI", async () => {
    mockScript("Guion corto.");
    await generateSpokenScript({ title: "Persiana X", bullets: ["Ligera", "Duradera"], description: "Ideal para exteriores." });
    const promptArg = (getAIResponse as jest.Mock).mock.calls[0][0][0].content as string;
    expect(promptArg).toContain("Título: Persiana X");
    expect(promptArg).toContain("- Ligera");
    expect(promptArg).toContain("- Duradera");
    expect(promptArg).toContain("Descripción: Ideal para exteriores.");
  });

  it("does not leave an unresolved placeholder when a field's own text contains a placeholder-like token", async () => {
    mockScript("Guion corto.");
    // Regression test for the single-pass placeholder fix: a title containing
    // literal "{bullets}" text must not swallow the real bullets placeholder.
    await generateSpokenScript({
      title: "Producto con {bullets} en el nombre",
      bullets: ["Real bullet"],
      description: "d",
    });
    const promptArg = (getAIResponse as jest.Mock).mock.calls[0][0][0].content as string;
    expect(promptArg).toContain("- Real bullet");
    expect(promptArg).not.toMatch(/\{bullets\}\s*\n\{bullets\}|Características:\s*\n\{bullets\}/);
  });

  it("returns the script unchanged when it's within the length budget", async () => {
    mockScript("Un guion corto y natural.");
    const script = await generateSpokenScript({ title: "T", bullets: ["a"], description: "d" });
    expect(script).toBe("Un guion corto y natural.");
  });

  it("truncates an overlong script at the last sentence boundary instead of mid-word", async () => {
    const sentence = "Esta es una frase de ejemplo bastante larga para forzar el truncado. ";
    const longScript = sentence.repeat(20).trim(); // well over 900 chars
    mockScript(longScript);
    const script = await generateSpokenScript({ title: "T", bullets: ["a"], description: "d" });
    expect(script.length).toBeLessThan(longScript.length);
    expect(script.length).toBeLessThanOrEqual(900);
    expect(/[.!?]$/.test(script)).toBe(true);
  });
});
