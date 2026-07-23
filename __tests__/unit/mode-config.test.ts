import { MODE_CONFIG } from "@/lib/ai/prompts";

describe("MODE_CONFIG", () => {
  it("has all four modes", () => {
    expect(Object.keys(MODE_CONFIG).sort()).toEqual(["creative", "professional", "seo", "tecnica"]);
  });

  it("tecnica mode exists with a system prompt and temperature", () => {
    expect(MODE_CONFIG.tecnica.label).toBe("Ficha Técnica");
    expect(MODE_CONFIG.tecnica.systemPrompt.length).toBeGreaterThan(0);
    expect(typeof MODE_CONFIG.tecnica.temperature).toBe("number");
  });

  it("tecnica mode overrides the short-description rule", () => {
    expect(MODE_CONFIG.tecnica.systemPrompt).toMatch(/ANULA/);
    expect(MODE_CONFIG.tecnica.systemPrompt).toMatch(/## Especificaciones técnicas/);
    expect(MODE_CONFIG.tecnica.systemPrompt).toMatch(/## Instalación/);
    expect(MODE_CONFIG.tecnica.systemPrompt).toMatch(/## Preguntas frecuentes/);
  });

  it("charges 1 credit per product for creative, professional, and seo", () => {
    expect(MODE_CONFIG.creative.creditsPerProduct).toBe(1);
    expect(MODE_CONFIG.professional.creditsPerProduct).toBe(1);
    expect(MODE_CONFIG.seo.creditsPerProduct).toBe(1);
  });

  it("charges 2 credits per product for tecnica", () => {
    expect(MODE_CONFIG.tecnica.creditsPerProduct).toBe(2);
  });
});
