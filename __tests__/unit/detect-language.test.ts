import { detectLanguageMismatch } from "@/lib/text/detect-language";

describe("detectLanguageMismatch", () => {
  it("returns false when the text matches the expected language", () => {
    const text = "El producto está fabricado con materiales de la más alta calidad para el hogar y la cocina.";
    expect(detectLanguageMismatch(text, "es")).toBe(false);
  });

  it("returns true when the text is dominantly in a different language", () => {
    const text = "The product is manufactured with the highest quality materials for the home and kitchen area.";
    expect(detectLanguageMismatch(text, "es")).toBe(true);
  });

  it("returns false (known limitation) when there is not enough signal — short text", () => {
    expect(detectLanguageMismatch("Aluminio 25mm", "es")).toBe(false);
  });

  it("returns false (known limitation) when there is not enough signal — empty text", () => {
    expect(detectLanguageMismatch("", "es")).toBe(false);
  });
});
