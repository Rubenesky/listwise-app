import { meetsContentContract, generateBestOfN, hasVerbatimBulletOverlap, hasVerbatimSentenceOverlap, hasDuplicateBulletDataPoint, describeContentContractFailure, truncateAtWordBoundary } from "@/lib/ai/generation-contract";

function words(n: number): string {
  return Array(n).fill("palabra").join(" ");
}

// Regression (retest round 5, URL4/zapatillas): process-products.ts's Zod
// schema hard-truncates title with `.slice(0, 100)` as a safety net for when
// the model exceeds the prompt's own "máximo 100" rule. A real generation
// exceeded it and got cut mid-word: "...Estabilidad en Carreras Neut" (from
// "...Neutrales"). The safety net shouldn't produce a broken-looking title —
// truncate at the last word boundary before the limit instead.
describe("truncateAtWordBoundary", () => {
  it("returns the string unchanged when under the limit", () => {
    expect(truncateAtWordBoundary("Camiseta Algodón Orgánico", 100)).toBe("Camiseta Algodón Orgánico");
  });

  it("truncates at the last space before the limit instead of mid-word", () => {
    const title = "Zapatillas de Running con Malla Transpirable y Amortiguación Avanzada | Estabilidad en Carreras Neutrales";
    const result = truncateAtWordBoundary(title, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).not.toMatch(/Neut$/);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("falls back to a hard cut when there's no space within the limit", () => {
    const noSpaces = "a".repeat(150);
    const result = truncateAtWordBoundary(noSpaces, 100);
    expect(result.length).toBe(100);
  });

  it("returns the string unchanged when exactly at the limit", () => {
    const exact = "a".repeat(100);
    expect(truncateAtWordBoundary(exact, 100)).toBe(exact);
  });
});

describe("meetsContentContract", () => {
  it("passes when bullets >= 4 and description >= 120 words", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(120) })).toBe(true);
  });

  // Regression: real generation for auriculares/plastic.es (thin-attributes
  // source) produced only 3 bullets, violating the prompt's own "nunca menos
  // de 4" rule — this is exactly the case the retry loop in
  // process-products.ts exists to catch and re-attempt.
  it("fails when bullets < 4, even with a long enough description", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c"], description: words(150) })).toBe(false);
  });

  it("fails when description is under 120 words, even with enough bullets", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(80) })).toBe(false);
  });

  it("passes with more than 4 bullets", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d", "e", "f"], description: words(200) })).toBe(true);
  });

  it("treats exactly 120 words as sufficient (inclusive boundary)", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(120) })).toBe(true);
  });

  it("treats 119 words as insufficient", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(119) })).toBe(false);
  });
});

// Regression (retest round 4): the prompt-only fix for bullet/description
// redundancy (a widened PROHIBIDO rule + AUTOVERIFICACION example) shipped
// but didn't hold — URL3 and URL4 still restated bullet content in the
// description, URL4 verbatim ("estabilidad neutra es adecuada para
// cualquier ritmo de carrera, desde 4:30 a 5:30 min/km" appeared identically
// in a bullet and the description). Defense-in-depth: this catches the
// worst case (a long verbatim chunk shared between a bullet and the
// description) as a hard, testable signal, on top of the prompt-side fix —
// it won't catch every paraphrase, but it catches exactly the failure
// actually observed.
describe("hasVerbatimBulletOverlap", () => {
  it("detects a 6+ word chunk shared verbatim between a bullet and the description", () => {
    const bullets = ["ESTABILIDAD NEUTRA: adecuada para cualquier ritmo de carrera, desde 4:30 a 5:30 min/km"];
    const description = "La estabilidad neutra es adecuada para cualquier ritmo de carrera, desde 4:30 a 5:30 min/km y te permite concentrarte en el entrenamiento.";
    expect(hasVerbatimBulletOverlap(bullets, description)).toBe(true);
  });

  it("returns false when the description paraphrases instead of repeating verbatim", () => {
    const bullets = ["BLUETOOTH 5.4: conecta sin cables a 15 m de distancia"];
    const description = "Olvídate de los cables: la conexión se mantiene estable incluso a varios metros de tu dispositivo.";
    expect(hasVerbatimBulletOverlap(bullets, description)).toBe(false);
  });

  it("does not flag short, incidental word overlap (common words, under the threshold)", () => {
    const bullets = ["MALLA TRANSPIRABLE: mantiene el pie fresco en cualquier entrenamiento"];
    const description = "Con esta zapatilla, cada entrenamiento se siente distinto desde el primer kilómetro.";
    expect(hasVerbatimBulletOverlap(bullets, description)).toBe(false);
  });

  it("returns false when there are no bullets or an empty description", () => {
    expect(hasVerbatimBulletOverlap([], "cualquier descripción")).toBe(false);
    expect(hasVerbatimBulletOverlap(["ALGO: relevante para el caso de prueba aquí"], "")).toBe(false);
  });
});

// Regression (retest round 6, URL2/auriculares): once the 120-word retry
// started working, the SECOND attempt sometimes hit the minimum by
// self-repeating instead of writing new content — paragraph 3 restated
// paragraph 1 almost verbatim. The original paragraph-only version of this
// check (split on \n\n) missed a further case in round 7: URL4's "La
// zapatilla de running Wave es..." refrain repeated 3 times INSIDE one long
// single paragraph (no \n\n breaks at all), and URL1's "una prenda que
// refleje su/tu personalidad y su/tu compromiso con el medio ambiente"
// echoed twice the same way. Splitting by sentence instead of paragraph
// catches both: a repeated paragraph is also repeated sentences, so this is
// a strict generalization, not a parallel check.
describe("hasVerbatimSentenceOverlap", () => {
  it("detects a 6+ word chunk shared verbatim across paragraphs", () => {
    const description = [
      "Estos auriculares inalámbricos ofrecen hasta 30 horas de música sin necesidad de recargar en cualquier momento del día.",
      "Usa tus auriculares para hacer ejercicio o trabajar sin interrupciones.",
      "Estos auriculares inalámbricos ofrecen hasta 30 horas de música sin necesidad de recargar, así que nunca te quedarás sin batería.",
    ].join("\n\n");
    expect(hasVerbatimSentenceOverlap(description)).toBe(true);
  });

  // The round-7 regression this check was specifically added for: a
  // repeated refrain within a single paragraph, no \n\n anywhere.
  it("detects a repeated refrain within a single paragraph (no paragraph breaks)", () => {
    const description =
      "Son las 5:00 de la mañana y estás listo para entrenar. La zapatilla de running Wave es tu aliada para alcanzar tus metas. " +
      "Reduce el impacto en cada paso gracias a su amortiguación avanzada. La zapatilla de running Wave es tu herramienta para lograr precisión. " +
      "Con ella corres más lejos sin fatiga. La zapatilla de running Wave es la elección perfecta para cualquier corredor.";
    expect(hasVerbatimSentenceOverlap(description)).toBe(true);
  });

  it("returns false when sentences cover different ground", () => {
    const description = [
      "Son las 6 de la mañana y estás listo para entrenar.",
      "La malla transpirable mantiene tus pies frescos durante todo el recorrido.",
      "El resultado es una carrera sin distracciones, kilómetro tras kilómetro.",
    ].join("\n\n");
    expect(hasVerbatimSentenceOverlap(description)).toBe(false);
  });

  it("returns false for a short description with no repetition", () => {
    expect(hasVerbatimSentenceOverlap("Un único párrafo sin saltos de línea dobles en el texto.")).toBe(false);
  });
});

// Regression (retest round 7, URL2/auriculares): bullet 1 ("BLUETOOTH 5.4:
// Conecta sin cables a 15 m sin obstáculos") and bullet 4 ("CONEXIÓN DE 15
// M: Escucha sin cables en cualquier lugar") describe the SAME fact (15m
// wireless range) with different wording — no literal 6-word overlap, so
// hasVerbatimBulletOverlap wouldn't catch it. Two different bullets citing
// the exact same number+unit is a strong, cheap signal that they're
// covering the same point instead of distinct ones, without needing an AI
// call to judge meaning.
describe("hasDuplicateBulletDataPoint", () => {
  it("detects the same number+unit repeated across two different bullets", () => {
    const bullets = [
      "BLUETOOTH 5.4: Conecta sin cables a 15 m sin obstáculos",
      "BATERÍA DE 30 MAH: Dura hasta 10 horas de reproducción",
      "MICROFONOS DE CUATRO: Grabaciones de alta calidad para llamadas y chats",
      "CONEXIÓN DE 15 M: Escucha sin cables en cualquier lugar",
    ];
    expect(hasDuplicateBulletDataPoint(bullets)).toBe(true);
  });

  it("returns false when every bullet cites a distinct data point", () => {
    const bullets = [
      "AMORTIGUACIÓN DE 10MM: reduce el impacto en cada paso",
      "PESO DE 272G: ligereza para corredores exigentes",
      "DROP DE 8MM: transición natural del talón a la puntera",
      "SUELA DE 4MM: agarre en superficies húmedas",
    ];
    expect(hasDuplicateBulletDataPoint(bullets)).toBe(false);
  });

  it("returns false for bullets with no numeric data at all", () => {
    const bullets = ["DISEÑO ÚNICO: árbol en el centro", "MATERIAL SOSTENIBLE: algodón certificado", "COMODIDAD: ajuste relajado", "DURADERA: resiste lavados"];
    expect(hasDuplicateBulletDataPoint(bullets)).toBe(false);
  });
});

describe("describeContentContractFailure", () => {
  it("returns no issues for a generation that meets every rule", () => {
    const bullets = ["CONCEPTO UNO: detalle específico", "CONCEPTO DOS: detalle específico", "CONCEPTO TRES: detalle específico", "CONCEPTO CUATRO: detalle específico"];
    expect(describeContentContractFailure({ bullets, description: words(120) })).toEqual([]);
  });

  it("names the specific issue for too few bullets", () => {
    const issues = describeContentContractFailure({ bullets: ["a", "b", "c"], description: words(150) });
    expect(issues.some((i) => /3 bullets/.test(i))).toBe(true);
  });

  it("names the specific issue for a short description", () => {
    const issues = describeContentContractFailure({ bullets: ["a", "b", "c", "d"], description: words(80) });
    expect(issues.some((i) => /80 palabras/.test(i))).toBe(true);
  });

  it("can report multiple issues at once", () => {
    const issues = describeContentContractFailure({ bullets: ["a", "b"], description: words(50) });
    expect(issues.length).toBe(2);
  });
});

describe("meetsContentContract with verbatim overlap", () => {
  it("fails the contract when bullets/word-count are fine but a bullet is verbatim-duplicated in the description", () => {
    const bullets = [
      "ESTABILIDAD NEUTRA: adecuada para cualquier ritmo de carrera, desde 4:30 a 5:30 min/km",
      "b",
      "c",
      "d",
    ];
    const description =
      words(60) +
      " la estabilidad neutra es adecuada para cualquier ritmo de carrera, desde 4:30 a 5:30 min/km " +
      words(60);
    expect(meetsContentContract({ bullets, description })).toBe(false);
  });
});

// Regression (retest round 8): sequential feedback-driven retries fixed real
// bugs (self-padding, missing bullets) but multiplied latency — up to 3x
// wall-clock time in the worst case, an unacceptable cost when generation
// speed is a stated competitive advantage. Replaced with parallel best-of-N:
// fire N independent candidates at once (same total AI cost, ~1x wall-clock
// time since they run concurrently) and keep whichever meets the contract,
// or the one with the fewest issues if none do. No feedback loop needed —
// the two root-cause prompt fixes from this round (word-count reinforcement,
// the CIERRE anti-generic-closing rule) now carry that weight instead, so
// every candidate benefits equally rather than only later sequential ones.
describe("generateBestOfN", () => {
  it("calls generate n times and returns a passing candidate when one exists", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ bullets: ["a", "b", "c"], description: words(150) })
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    const result = await generateBestOfN(generate, 2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.bullets.length).toBe(4);
  });

  it("calls generate with no arguments (no sequential feedback needed — candidates are independent)", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a", "b", "c", "d"], description: words(120) });
    await generateBestOfN(generate, 3);
    for (const call of generate.mock.calls) {
      expect(call.length).toBe(0);
    }
  });

  it("returns the candidate with the fewest issues when none pass", async () => {
    const worse = { bullets: ["a", "b"], description: words(50) }; // 2 issues
    const better = { bullets: ["a", "b", "c"], description: words(150) }; // 1 issue
    const generate = jest.fn().mockResolvedValueOnce(worse).mockResolvedValueOnce(better);
    const result = await generateBestOfN(generate, 2);
    expect(result).toBe(better);
  });

  it("works with n=1 (single candidate, no comparison needed)", async () => {
    const only = { bullets: ["a", "b", "c", "d"], description: words(120) };
    const generate = jest.fn().mockResolvedValue(only);
    const result = await generateBestOfN(generate, 1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toBe(only);
  });

  it("invokes onAttempt for every candidate with its index and issues", async () => {
    const first = { bullets: ["a", "b", "c"], description: words(150) };
    const second = { bullets: ["a", "b", "c", "d"], description: words(150) };
    const generate = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onAttempt = jest.fn();
    await generateBestOfN(generate, 2, onAttempt);
    expect(onAttempt).toHaveBeenCalledWith(0, first, expect.arrayContaining([expect.stringMatching(/3 bullets/)]));
    expect(onAttempt).toHaveBeenCalledWith(1, second, []);
  });

  // Regression (2026-08-27, live-demo prep): Promise.all fails the entire
  // batch the instant ANY one candidate rejects (invalid JSON, extra text,
  // failed schema validation) — even when the other candidates parsed fine.
  // A real bulk CSV upload hit this: 4 of 21 products were marked FAILED in
  // the DB even though ~2 of their 3 parallel candidates almost certainly
  // generated valid content that got discarded along with the one bad one.
  it("keeps the batch alive when only some candidates fail to parse — picks the best of the ones that succeeded", async () => {
    const worse = { bullets: ["a", "b", "c"], description: words(50) }; // 2 issues
    const better = { bullets: ["a", "b", "c", "d"], description: words(150) }; // 0 issues
    const generate = jest
      .fn()
      .mockResolvedValueOnce(worse)
      .mockRejectedValueOnce(new Error("La IA no devolvió datos en el formato correcto."))
      .mockResolvedValueOnce(better);
    const result = await generateBestOfN(generate, 3);
    expect(result).toBe(better);
  });

  it("still throws when every candidate fails to parse (unchanged fail-closed behavior)", async () => {
    const generate = jest.fn().mockRejectedValue(new Error("JSON inválido"));
    await expect(generateBestOfN(generate, 3)).rejects.toThrow("JSON inválido");
  });
});
