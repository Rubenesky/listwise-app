import { MODE_CONFIG, buildSystemPrompt } from "@/lib/ai/prompts";

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

describe("buildSystemPrompt", () => {
  // Regression test: the override used to live only in MODE_CONFIG.tecnica's
  // user-prompt overlay, which the system prompt's own "2 a 3 párrafos" rule
  // and JSON example silently won against, producing standard short
  // descriptions even when tecnica mode was correctly selected.
  it("tecnica mode's system prompt requires the section markers and drops the short-form rule", () => {
    const prompt = buildSystemPrompt("tecnica");
    expect(prompt).toMatch(/MODO FICHA TÉCNICA/);
    expect(prompt).toMatch(/## Especificaciones técnicas/);
    expect(prompt).toMatch(/## Instalación/);
    expect(prompt).toMatch(/## Preguntas frecuentes/);
    expect(prompt).not.toMatch(/DESCRIPCIÓN \(2 a 3 párrafos\)/);
    // The JSON example must model the sectioned shape, not "párrafo1\n\npárrafo2\n\npárrafo3"
    expect(prompt).toMatch(/"description":"gancho\\n\\n## Especificaciones técnicas/);
  });

  it("other modes keep the short-form rule and JSON example unchanged", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).toMatch(/DESCRIPCIÓN \(2 a 3 párrafos\)/);
      expect(prompt).toMatch(/"description":"párrafo1\\n\\npárrafo2\\n\\npárrafo3"/);
      expect(prompt).not.toMatch(/## Especificaciones técnicas/);
    }
  });
});
