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
