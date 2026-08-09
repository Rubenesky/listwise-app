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
      expect(prompt).toMatch(/DESCRIPCIÓN \(2 a 3 párrafos/);
      expect(prompt).not.toMatch(/## Especificaciones técnicas/);
    }
  });

  // Regression test: a real staging generation echoed the JSON format example
  // literally ("párrafo1", "párrafo2", "párrafo3" as actual paragraph text,
  // and "BENEFICIO EN MAYÚSCULAS:" as an actual bullet) instead of treating it
  // as a placeholder to substitute. An earlier fix wrapped the example in
  // <angle brackets>, but that wasn't enough — the bracketed text still read
  // as label-shaped content ("<párrafo 1>") the model could echo in some form
  // ("párrafo1"). The JSON template's description field now has no
  // example-shaped text at all, only a prose description of what's expected.
  // The bullet format example was replaced with a concrete, clearly-unrelated
  // illustration (a hiking-battery bullet) instead of a fill-in-the-blank
  // pattern, with an explicit "don't copy this" instruction.
  it("keeps the JSON example's description field free of example-shaped text, and marks the bullet-format illustration as not-to-copy", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).not.toMatch(/"description":"párrafo1\\n\\npárrafo2\\n\\npárrafo3"/);
      expect(prompt).not.toMatch(/"description":"<párrafo 1>\\n\\n<párrafo 2>\\n\\n<párrafo 3>"/);
      expect(prompt).not.toMatch(/"description":"[^"]*párrafo 1[^"]*párrafo 2/);
      expect(prompt).not.toMatch(/"BENEFICIO EN MAYÚSCULAS: detalle específico que lo explica"/);
      expect(prompt).not.toMatch(/"<BENEFICIO EN MAYÚSCULAS>: <detalle específico que lo explica>"/);
      expect(prompt.toLowerCase()).toContain("nunca copies este ejemplo");
    }
  });

  // Regression: even after the JSON-example fix above, a real generation for
  // URL 4 (aceite de oliva) came back with a description of literally
  // "párrafo1\n\npárrafo2\n\npárrafo3" — the labels, with NO content between
  // them. The JSON example wasn't the source this time: the REGLAS section
  // itself still had "PÁRRAFO 1 — GANCHO:", "PÁRRAFO 2 — CONTEXTO DE USO:",
  // "PÁRRAFO 3 — CIERRE:" as ALL-CAPS section headers describing what each
  // paragraph should cover — instructional text for a human prompt-reader,
  // but shaped exactly like a literal section label the model could echo.
  it("does not use ALL-CAPS 'PÁRRAFO N —' section headers anywhere in the description rules", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).not.toMatch(/PÁRRAFO \d\s*—/);
      expect(prompt.toLowerCase()).toContain("sin numerar");
    }
  });

  // Regression: even the reworded (non-bracketed, concrete-example) bullet
  // format instruction still contained the literal phrase "beneficio
  // principal EN MAYÚSCULAS" — for a near-empty source (real staging case:
  // olivammarket.com's page repeats only the product title, no real specs),
  // the model echoed that meta-descriptive phrase itself as bullet #1's
  // content ("BENEFICIO EN MAYÚSCULAS: Sin aditivos...") three separate
  // times across two prior fix attempts, always on the same low-content
  // source, never on richer sources. Removing the exact "beneficio ...
  // MAYÚSCULAS" word-adjacency and adding an explicit Formato B fallback for
  // when there isn't enough substance for a specific all-caps benefit.
  it("does not phrase the bullet format rule as 'beneficio ... MAYÚSCULAS', and offers Formato B as a fallback for thin content", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).not.toMatch(/beneficio principal EN MAYÚSCULAS/i);
      expect(prompt.toLowerCase()).toContain("usa el formato b");
    }
  });

  // Regression (audit finding): real generations reliably undershot the
  // 120-280 word target, landing closer to 80-100 words even on real,
  // content-rich sources — the single biggest point-loser in health-score.ts
  // (8/20 instead of 20/20 on word count alone). Soft length guidance
  // ("2 a 3 párrafos") wasn't a strong enough signal; the rule now restates
  // the numeric floor explicitly and tells the model how to reach it
  // (expand context-of-use/sensory detail) instead of stopping early.
  it("restates the 120-word minimum explicitly, with guidance on how to reach it", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).toMatch(/120/);
      expect(prompt.toLowerCase()).toMatch(/no.*(bajes|quedes).*120|mínimo.*120|al menos 120/);
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
