import { calcHealthScore, analyzeDescriptionTecnica, analyzeDescription } from "@/lib/listings/health-score";

const TECNICA_DESCRIPTION = [
  "Gancho breve presentando el producto.",
  "",
  "## Especificaciones técnicas",
  Array(150).fill("palabra").join(" "),
  "",
  "## Instalación",
  Array(150).fill("palabra").join(" "),
  "",
  "## Preguntas frecuentes",
  Array(150).fill("palabra").join(" "),
].join("\n");

const SHORT_DESCRIPTION = "Imagina el mejor producto para tu día a día. El resultado es una experiencia inigualable.";

describe("analyzeDescriptionTecnica", () => {
  it("scores full points when all 3 sections are present and word count is in range", () => {
    const result = analyzeDescriptionTecnica(TECNICA_DESCRIPTION);
    expect(result.score).toBe(40);
  });

  it("does not penalize the absence of Future Pacing or 'el resultado'", () => {
    const result = analyzeDescriptionTecnica(TECNICA_DESCRIPTION);
    expect(result.notes.join(" ")).not.toMatch(/falta Future Pacing|falta cierre/);
  });

  it("scores lower when sections are missing", () => {
    const partial = "Gancho.\n\n## Especificaciones técnicas\n" + Array(60).fill("palabra").join(" ");
    const result = analyzeDescriptionTecnica(partial);
    expect(result.score).toBeLessThan(40);
    expect(result.notes.join(" ")).toMatch(/faltan secciones/);
  });
});

describe("analyzeDescription hook_type scoring", () => {
  // Regression: the prompt supports 4 hook types (scene/question/bold/benefit,
  // see REQUIRED_HOOK_TYPE in prompts.ts), but this function only recognized
  // "Imagina" (Future Pacing) and a narrow formal-tone regex — a correctly
  // executed "scene" hook ("Son las 6 de la mañana y...") scored 0 for its
  // opening despite following the prompt's own rules exactly. hook_type is
  // already stored on every listing generated after that column existed —
  // use it as the authoritative signal instead of regex-sniffing.
  const SCENE_DESCRIPTION =
    "Son las 6 de la mañana y ya estás listo para entrenar. El resultado es una carrera sin límites.";

  it("awards the hook bonus for a 'scene' hook_type even when the text doesn't match the old regex", () => {
    const withoutHookType = analyzeDescription(SCENE_DESCRIPTION);
    const withHookType = analyzeDescription(SCENE_DESCRIPTION, "scene");
    expect(withoutHookType.notes.join(" ")).toMatch(/falta/);
    expect(withHookType.notes.join(" ")).toMatch(/gancho "scene" ✓/);
    expect(withHookType.score).toBeGreaterThan(withoutHookType.score);
  });

  it("awards the hook bonus for question, bold, and benefit hook_types too", () => {
    for (const hookType of ["question", "bold", "benefit"]) {
      const result = analyzeDescription(SCENE_DESCRIPTION, hookType);
      expect(result.notes.join(" ")).toContain(`gancho "${hookType}" ✓`);
    }
  });

  it("falls back to regex-based Future Pacing detection for legacy rows with no hook_type", () => {
    const result = analyzeDescription(SHORT_DESCRIPTION, null);
    expect(result.notes.join(" ")).toMatch(/Future Pacing ✓/);
  });

  it("ignores an unrecognized hook_type value and falls back to regex detection", () => {
    const result = analyzeDescription(SHORT_DESCRIPTION, "not-a-real-hook-type");
    expect(result.notes.join(" ")).toMatch(/Future Pacing ✓/);
  });
});

describe("calcHealthScore mode dispatch", () => {
  it("uses the tecnica analyzer when '## ' section markers are present", () => {
    const score = calcHealthScore({
      status: "COMPLETED",
      generatedTitle: "Persiana Veneciana Aluminio 25mm para Interiores y Exteriores",
      generatedBullets: [
        "CONTROL DE LUZ: ajuste preciso de lamas",
        "DURABILIDAD: aluminio resistente",
        "MANTENIMIENTO SENCILLO: fácil de limpiar",
        "DISEÑO VERSÁTIL: se adapta a cualquier espacio",
      ],
      generatedDescription: TECNICA_DESCRIPTION,
    });
    // Would score far lower under the short-mode analyzer (fails word-count + no Future Pacing/"el resultado")
    expect(analyzeDescription(TECNICA_DESCRIPTION).score).toBeLessThan(analyzeDescriptionTecnica(TECNICA_DESCRIPTION).score);
    expect(score).toBeGreaterThan(80);
  });

  it("still uses the short-mode analyzer for regular descriptions (no section markers)", () => {
    const score = calcHealthScore({
      status: "COMPLETED",
      generatedTitle: "Sudadera Oversized Algodón Orgánico 100% para Uso Diario",
      generatedBullets: [
        "ALGODÓN ORGÁNICO: sin químicos en contacto con la piel",
        "OVERSIZED: corte amplio y cómodo",
        "VERSÁTIL: combina con cualquier look",
        "DURADERA: resiste lavados repetidos",
      ],
      generatedDescription: SHORT_DESCRIPTION,
    });
    expect(score).toBeGreaterThan(0);
  });
});
