import { MODE_CONFIG, buildSystemPrompt, buildUserPromptTecnica, buildUserPromptWithVoice, type VoiceProfileData } from "@/lib/ai/prompts";

describe("MODE_CONFIG", () => {
  it("has all four modes", () => {
    expect(Object.keys(MODE_CONFIG).sort()).toEqual(["creative", "professional", "seo", "tecnica"]);
  });

  it("tecnica mode exists with a temperature", () => {
    expect(MODE_CONFIG.tecnica.label).toBe("Ficha Técnica");
    expect(typeof MODE_CONFIG.tecnica.temperature).toBe("number");
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
  // Regression test: an earlier attempt kept tecnica mode's override inside the
  // shared marketing SYSTEM_PROMPT (as a conditionally-swapped block). That
  // competed against the same prompt's "Imagina" / Future Pacing / Contrast
  // Frame instructions, repeated and reinforced elsewhere in the same prompt,
  // and lost — real generations came back as standard short descriptions.
  // tecnica mode now gets its own fully separate prompt with none of that
  // marketing machinery to compete against.
  it("tecnica mode has its own prompt with the section markers and no short-form rule", () => {
    const prompt = buildSystemPrompt("tecnica");
    expect(prompt).toMatch(/## Especificaciones técnicas/);
    expect(prompt).toMatch(/## Instalación/);
    expect(prompt).toMatch(/## Preguntas frecuentes/);
    expect(prompt).not.toMatch(/DESCRIPCIÓN \(2 a 3 párrafos\)/);
    // No emotional-hook machinery that could pull the model back to short-form
    expect(prompt).not.toMatch(/FUTURE PACING/);
    expect(prompt).not.toMatch(/CONTRAST FRAME/);
    // The JSON example must model the sectioned shape, not "párrafo1\n\npárrafo2\n\npárrafo3"
    expect(prompt).toMatch(/"description":"gancho\\n\\n## Especificaciones técnicas/);
  });

  it("other modes keep the short-form rule and hook machinery unchanged", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).toMatch(/DESCRIPCIÓN \(2 a 3 párrafos\)/);
      expect(prompt).not.toMatch(/## Especificaciones técnicas/);
    }
  });

  // Regression test: a real staging generation echoed the JSON format example
  // literally ("párrafo1", "párrafo2", "párrafo3" as actual paragraph text,
  // and "BENEFICIO EN MAYÚSCULAS:" as an actual bullet) instead of treating it
  // as a placeholder to substitute. The example strings looked like real
  // content the model could copy rather than a template to fill in.
  it("marks the JSON example's description and bullet format as placeholders, not literal text to echo", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).not.toMatch(/"description":"párrafo1\\n\\npárrafo2\\n\\npárrafo3"/);
      expect(prompt).toMatch(/"description":"<párrafo 1>\\n\\n<párrafo 2>\\n\\n<párrafo 3>"/);
      expect(prompt).not.toMatch(/"BENEFICIO EN MAYÚSCULAS: detalle específico que lo explica"/);
      expect(prompt).toMatch(/"<BENEFICIO EN MAYÚSCULAS>: <detalle específico que lo explica>"/);
    }
  });
});

describe("buildUserPromptTecnica", () => {
  it("includes confirmed attributes and skips emotional-hook devices", () => {
    const prompt = buildUserPromptTecnica({
      productName: "Persiana Veneciana Aluminio",
      category: "Hogar",
      attributes: { material: "aluminio", medidas: "120x150cm" },
    });
    expect(prompt).toMatch(/Persiana Veneciana Aluminio/);
    expect(prompt).toMatch(/aluminio/);
    expect(prompt).not.toMatch(/Emoción de compra dominante/);
    expect(prompt).not.toMatch(/Tipo de apertura OBLIGATORIO/);
    expect(prompt).not.toMatch(/Calibración de tono/);
  });

  it("warns not to invent data when no attributes are confirmed", () => {
    const prompt = buildUserPromptTecnica({ productName: "Mosquitera a medida", category: null, attributes: null });
    expect(prompt).toMatch(/no tiene atributos confirmados/);
  });
});

describe("buildUserPromptWithVoice with tecnica mode", () => {
  // Regression test: real staging generations kept coming back as standard
  // marketing copy (with "Imagine..." Future Pacing and an unrequested
  // title_b) even after tecnica mode got its own fully separate prompt. Root
  // cause: this function still appended the active Voice Profile's
  // tone/vocabulary/suggestions — extracted from marketing-style example
  // descriptions — *after* the tecnica prompt, reintroducing exactly the
  // emotional patterns the dedicated prompt prohibits.
  const voiceProfile: VoiceProfileData = {
    tone: "emocional y persuasivo",
    vocabulary: "aspiracional",
    sentenceStructure: "frases cortas con Future Pacing",
    keyWords: ["imagina", "descubre"],
    brandPersonality: "cercana y entusiasta",
    suggestions: ["abre con Imagina para conectar emocionalmente"],
  };

  it("does not append brand-voice guidance for tecnica mode even with an active voice profile", () => {
    const prompt = buildUserPromptWithVoice(
      { productName: "Persiana Veneciana Aluminio", category: "Hogar", attributes: null, mode: "tecnica" },
      voiceProfile
    );
    expect(prompt).not.toMatch(/VOZ_DE_MARCA/);
    expect(prompt).not.toMatch(/Imagina para conectar/);
  });

  it("still appends brand-voice guidance for other modes", () => {
    const prompt = buildUserPromptWithVoice(
      { productName: "Sudadera Oversized", category: "Ropa", attributes: null, mode: "creative" },
      voiceProfile
    );
    expect(prompt).toMatch(/VOZ_DE_MARCA/);
  });
});
