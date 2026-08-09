import { meetsContentContract, generateWithContentRetry, hasVerbatimBulletOverlap, hasVerbatimParagraphOverlap, describeContentContractFailure, truncateAtWordBoundary } from "@/lib/ai/generation-contract";

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
// paragraph 1 almost verbatim ("Estos auriculares inalámbricos... ofrecen
// hasta 30 horas de música sin necesidad de recargar. Conecta a tu
// dispositivo sin cables a 15 m de distancia gracias al Bluetooth 5.4"
// appeared in both). hasVerbatimBulletOverlap didn't catch it — it only
// compares bullets against the description, not the description against
// itself.
describe("hasVerbatimParagraphOverlap", () => {
  it("detects a 6+ word chunk shared verbatim between two paragraphs of the same description", () => {
    const description = [
      "Estos auriculares inalámbricos ofrecen hasta 30 horas de música sin necesidad de recargar en cualquier momento del día.",
      "Usa tus auriculares para hacer ejercicio o trabajar sin interrupciones.",
      "Estos auriculares inalámbricos ofrecen hasta 30 horas de música sin necesidad de recargar, así que nunca te quedarás sin batería.",
    ].join("\n\n");
    expect(hasVerbatimParagraphOverlap(description)).toBe(true);
  });

  it("returns false when paragraphs cover different ground", () => {
    const description = [
      "Son las 6 de la mañana y estás listo para entrenar.",
      "La malla transpirable mantiene tus pies frescos durante todo el recorrido.",
      "El resultado es una carrera sin distracciones, kilómetro tras kilómetro.",
    ].join("\n\n");
    expect(hasVerbatimParagraphOverlap(description)).toBe(false);
  });

  it("returns false for a single-paragraph description (nothing to compare)", () => {
    expect(hasVerbatimParagraphOverlap("Un único párrafo sin saltos de línea dobles en el texto.")).toBe(false);
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

// Regression: the retry orchestration in process-products.ts (call AI, check
// meetsContentContract, retry once on a miss, accept the last result
// regardless) had no test coverage — the trigger job itself pulls in
// @trigger.dev/sdk, the DB, and the AI provider, none of which are mocked
// anywhere in this codebase's test suite. Extracting the loop as a pure,
// callback-driven helper makes the retry *decision* testable without adding
// a new mocking pattern for Trigger.dev jobs.
describe("generateWithContentRetry", () => {
  it("calls generate only once when the first result already meets the contract", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a", "b", "c", "d"], description: words(120) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.bullets.length).toBe(4);
  });

  it("retries once and returns the second result when the first misses the contract", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ bullets: ["a", "b", "c"], description: words(150) })
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.bullets.length).toBe(4);
  });

  it("stops after maxAttempts and returns the last result even if still insufficient", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a", "b", "c"], description: words(150) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.bullets.length).toBe(3); // accepted anyway — no listing left without content
  });

  it("never retries when maxAttempts is 1, regardless of content sufficiency", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a"], description: words(10) });
    await generateWithContentRetry(generate, 1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry with the attempt number, the failing result, and the specific issues found", async () => {
    const insufficientResult = { bullets: ["a", "b", "c"], description: words(150) };
    const generate = jest
      .fn()
      .mockResolvedValueOnce(insufficientResult)
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    const onRetry = jest.fn();
    await generateWithContentRetry(generate, 2, onRetry);
    expect(onRetry).toHaveBeenCalledWith(1, insufficientResult, expect.arrayContaining([expect.stringMatching(/3 bullets/)]));
  });

  // Regression: retrying with the exact same prompt sometimes made things
  // WORSE (see hasVerbatimParagraphOverlap above — the model padded word
  // count by repeating itself). Passing specific, concrete feedback about
  // what was wrong on the previous attempt is the standard fix for
  // LLM retry loops that blindly resample the same prompt.
  it("passes a feedback string describing the specific issues to generate() on retry", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ bullets: ["a", "b", "c"], description: words(150) })
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenNthCalledWith(1);
    const feedbackArg = generate.mock.calls[1][0];
    expect(feedbackArg).toMatch(/3 bullets/);
    expect(feedbackArg.toLowerCase()).toMatch(/no repitas/);
  });
});
