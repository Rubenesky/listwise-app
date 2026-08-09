import { MODE_CONFIG, buildSystemPrompt, buildUserPrompt, buildUserPromptTecnica, buildUserPromptWithVoice, getRequiredHookType, type VoiceProfileData } from "@/lib/ai/prompts";

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
  // Regression (real staging generation, auriculares/plastic.es — a thin-source
  // URL-enriched product with empty attributes): the bullet-padding fallback
  // instruction ("añade: (a) contexto de uso ideal, (b) para quién es ideal y
  // para quién no, (c) la consecuencia emocional del beneficio principal") was
  // repeated 3 times across the prompt as an enumerated, copyable label. With a
  // thin source giving the model little real content to write about, it echoed
  // the label itself as bullet content ("La consecuencia emocional de esta
  // autonomía es el ahorro de tiempo..."), dropping to 3 bullets total —
  // violating the explicit "nunca menos de 4" rule. Same root cause as the
  // earlier "PÁRRAFO N" / "BENEFICIO EN MAYÚSCULAS" echoes, in a spot those
  // fixes never touched. The phrase is removed everywhere it appeared as a
  // fallback label; guidance is now prose instructing the model not to echo it.
  it("does not phrase the bullet-padding fallback as a literal 'consecuencia emocional del beneficio principal' label", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).not.toMatch(/consecuencia emocional del beneficio principal/i);
    }
  });

  // Regression (10-expert panel, round 2): naming the 3 closing patterns
  // ("el resultado es...", "lo que notas desde el primer día...", "sin tener
  // que...") without a concrete example never moved the needle — 0 of 4 real
  // retested generations used any of them. The bullet Formato A rule only
  // started working reliably once it got a full illustrative sentence instead
  // of just a named pattern — applying the same fix to the closing rule.
  it("gives a concrete example closing sentence, not just the 3 named patterns, with a don't-copy instruction", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt).toMatch(/el resultado es[^"]*sin tener que levantarte/i);
      expect(prompt.toLowerCase()).toContain("nunca copies este ejemplo");
    }
  });

  // Regression (retest round 3): real generations for all 4 retested URLs had
  // paragraph 2 restate bullet content — sometimes verbatim (URL4's "estabilidad
  // neutra es adecuada para cualquier ritmo de carrera, desde 4:30 a 5:30
  // min/km" appeared identically in both a bullet and the description). The
  // existing PROHIBIDO rule and AUTOVERIFICACION item 12 only illustrated a
  // telegraphic-list failure shape ("La función X... El componente Y...") —
  // full-sentence paraphrases of a bullet's content didn't visually match that
  // example, so the model's own self-check never flagged them. Both are now
  // widened to cover paraphrase, not just list-shaped repetition, with a
  // concrete before/after example.
  it("prohibits paraphrased repetition of bullet content in paragraph 2, not just telegraphic-list repetition, with a before/after example", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt.toLowerCase()).toMatch(/reformulada con otro verbo|misma información con otras palabras/);
    }
  });

  it("the autoverificacion checklist also catches paraphrased (not just list-shaped) bullet repetition", () => {
    for (const mode of ["creative", "professional", "seo"] as const) {
      const prompt = buildSystemPrompt(mode);
      expect(prompt.toLowerCase()).toMatch(/aunque esté reformulada|aunque este reformulada/);
    }
  });
});

describe("getRequiredHookType", () => {
  // Regression: URL2 (auriculares/Electrónica) opened with a valid "benefit"-
  // style hook in the actual prose but the JSON's hook_type field came back
  // missing/invalid, silently losing 10 health-score points for a hook that
  // was written correctly. REQUIRED_HOOK_TYPE already prescribes the hook
  // deterministically per category — trust that over the model's self-report
  // for any category with a prescribed hook, instead of another prompt
  // reinforcement attempt for a field-tagging gap.
  it("returns the prescribed hook type for a category with a rule", () => {
    expect(getRequiredHookType("Electrónica")).toBe("benefit");
    expect(getRequiredHookType("Ropa")).toBe("bold");
    expect(getRequiredHookType("Belleza")).toBe("question");
    expect(getRequiredHookType("Deportes")).toBe("scene");
  });

  it("returns null for a category with no prescribed hook", () => {
    expect(getRequiredHookType("Otro")).toBeNull();
    expect(getRequiredHookType(null)).toBeNull();
  });
});

describe("buildUserPrompt category calibration (no literal copyable examples)", () => {
  // Regression (biggest finding of retest round 4): real generations for
  // auriculares (Electrónica) and zapatillas (Deportes) copied
  // CATEGORY_CALIBRATION's hook/bullet fields VERBATIM across multiple
  // retest rounds and completely different real source URLs — e.g. "Cuarenta
  // horas. La batería que no te da sustos en mitad de la semana." and "40H DE
  // AUTONOMÍA REAL: carga completa el domingo, aguanta hasta el viernes sin
  // enchufar" for Electrónica; "No todas las zapatillas de trail aguantan el
  // barro, la roca y el asfalto. Estas sí." for Deportes (used as the
  // CLOSING sentence, not even the hook it was written as). The existing
  // "(referencia — NO copies, adapta al producto real)" warning did not stop
  // this. Unlike the prompt's other examples — REQUIRED_HOOK_TYPE's bracketed
  // placeholders ("[número o dato específico] que cambia [rutina diaria]"),
  // the bullets section's deliberately-unrelated hiking-battery example —
  // CATEGORY_CALIBRATION paired a REAL, complete, grammatical sentence with
  // the SAME category as the real product, making it read as plausible
  // content instead of an obviously separate illustration. Removed entirely:
  // hook structure is already covered by REQUIRED_HOOK_TYPE, bullet structure
  // by the Formato A/B section.
  it("does not include literal copyable calibration example sentences for any category", () => {
    const categories = ["Ropa", "Electrónica", "Deportes", "Belleza", "Cocina", "Hogar", "Mascotas", "Bebé", "Accesorios", "Oficina"];
    for (const category of categories) {
      const prompt = buildUserPrompt({ productName: "Producto de prueba", category, attributes: { color: "negro" } });
      expect(prompt).not.toMatch(/Cuarenta horas\. La batería/);
      expect(prompt).not.toMatch(/No todas las zapatillas de trail/);
      expect(prompt).not.toMatch(/Título modelo/);
      expect(prompt).not.toMatch(/Gancho modelo/);
      expect(prompt).not.toMatch(/Bullet modelo/);
    }
  });
});

describe("buildUserPrompt thin-attributes branch", () => {
  // Same regression as above, but in the zero-confirmed-attributes branch of
  // buildUserPrompt — the exact branch a thin URL-enriched source hits (see
  // extract-product-info.ts's "leave attributes empty for thin sources" rule).
  // This was the third, most directly-triggered copy of the same literal label.
  it("does not phrase the no-attributes bullet fallback as a literal 'consecuencia emocional del beneficio principal' label", () => {
    const prompt = buildUserPrompt({ productName: "Auriculares Inalámbricos", category: "Electrónica", attributes: {} });
    expect(prompt).toMatch(/no tiene atributos confirmados/);
    expect(prompt).not.toMatch(/consecuencia emocional del beneficio principal/i);
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
