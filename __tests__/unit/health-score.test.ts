import { calcHealthScore, analyzeDescriptionTecnica, analyzeDescription, analyzeBullets, analyzeTitle, analyzeSpecificity } from "@/lib/listings/health-score";

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

describe("analyzeTitle symbol penalty", () => {
  // Regression (retest round 4, URL1): "Camiseta ... 100% Unisex ... | Sin
  // Químicos" lost 5 points because "%" was bundled into the same forbidden-
  // symbols regex as ®©™. Unlike trademark/legal symbols, "%" is a legitimate
  // unit for concrete data — exactly what buildSystemPrompt's TÍTULO rule
  // asks for ("Solo adjetivos con respaldo concreto: '40h de batería' no
  // 'batería duradera'"). Penalizing it contradicts the prompt's own
  // guidance. ®©™ remain penalized — those are genuinely never appropriate.
  it("does not penalize a percentage sign in the title", () => {
    const title = "Camiseta Algodón Orgánico 100% Unisex Corta Manga | Sin Químicos";
    const result = analyzeTitle(title);
    expect(result.notes.join(" ")).toMatch(/sin símbolos prohibidos/);
  });

  it("still penalizes trademark/legal symbols", () => {
    const title = "Auriculares Bluetooth® Inalámbricos con Cancelación de Ruido Activa";
    const result = analyzeTitle(title);
    expect(result.notes.join(" ")).toMatch(/contiene símbolos prohibidos/);
  });
});

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

describe("analyzeBullets Formato A / Formato B reconciliation", () => {
  // Regression: buildSystemPrompt's Formato B is a deliberate, sanctioned
  // fallback for bullets with too little data for Formato A's ALL-CAPS
  // concept lead-in (see prompts.ts's "usa el Formato B para ese bullet en
  // vez de forzar el Formato A"). The old detector only recognized Formato
  // A's exact "CONCEPTO: detalle" shape, so a bullet correctly following
  // Formato B — exactly what the prompt asked for on a thin-content product
  // — scored as "not following format" instead of full credit.
  const FORMATO_A = "CONTROL DE LUZ: ajuste preciso de lamas para cualquier hora del día";
  const FORMATO_B = "Ajusta la luz de tu salón sin levantarte del sofá";

  it("gives full bullet-format credit when all bullets are Formato A", () => {
    const result = analyzeBullets([FORMATO_A, FORMATO_A, FORMATO_A, FORMATO_A]);
    expect(result.notes.join(" ")).toMatch(/todos con formato/i);
  });

  it("gives full bullet-format credit when all bullets are Formato B", () => {
    const result = analyzeBullets([FORMATO_B, FORMATO_B, FORMATO_B, FORMATO_B]);
    expect(result.notes.join(" ")).toMatch(/todos con formato/i);
  });

  it("gives full credit for a legitimate mix of Formato A and Formato B", () => {
    const result = analyzeBullets([FORMATO_A, FORMATO_B, FORMATO_A, FORMATO_B]);
    expect(result.notes.join(" ")).toMatch(/todos con formato/i);
  });

  it("still withholds credit for bullets that follow neither format (too short, no structure)", () => {
    const result = analyzeBullets(["ok", "bien", "genial", "vale"]);
    expect(result.notes.join(" ")).not.toMatch(/todos con formato/i);
  });

  // Regression (retest round 4, URL1 ropa/organic-choice.es): a real
  // generation led two bullets with concrete data ("100% ALGODÓN ORGÁNICO
  // CERTIFICADO: ...", "200 g/m² DE GRAMAJE: ...") — exactly the kind of
  // "adjetivos con respaldo concreto" copy buildSystemPrompt's TÍTULO rule
  // asks for. Both failed Formato A (digits/% aren't in the ALL-CAPS
  // character class) AND the old Formato B check (required the first
  // character to be an uppercase letter, excluding a leading digit) — so
  // this health-score-favored copy scored WORSE than generic filler would
  // have. A bullet leading with a number is legitimate, concrete content.
  it("gives full format credit for bullets that lead with a concrete number or percentage", () => {
    const result = analyzeBullets([
      "100% ALGODÓN ORGÁNICO CERTIFICADO: sin químicos en contacto con tu piel",
      "200 g/m² DE GRAMAJE: ligero y suave para el verano",
      "CAMISETA UNISEX: para hombres y mujeres",
      "MANGA CORTA Y CUELLO REDONDO: diseño clásico y cómodo",
    ]);
    expect(result.notes.join(" ")).toMatch(/todos con formato/i);
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

describe("analyzeDescription closing-phrase detection", () => {
  // Regression: the CIERRE rule in prompts.ts explicitly offers 3 equivalent
  // closing patterns — "el resultado es...", "lo que notas desde el primer
  // día...", "sin tener que..." — but the scorer only ever checked for the
  // literal string "el resultado", so a closing that correctly followed the
  // prompt's own second or third example scored 0 for the closing beat.
  it("awards the closing bonus for 'el resultado' (already worked)", () => {
    const result = analyzeDescription("Texto de relleno suficientemente largo. El resultado es una experiencia mejor.");
    expect(result.notes.join(" ")).toMatch(/cierre .* ✓/);
  });

  it("awards the closing bonus for 'lo que notas desde el primer día'", () => {
    const result = analyzeDescription("Texto de relleno suficientemente largo. Lo que notas desde el primer día es la diferencia.");
    expect(result.notes.join(" ")).toMatch(/cierre .* ✓/);
  });

  it("awards the closing bonus for 'sin tener que'", () => {
    const result = analyzeDescription("Texto de relleno suficientemente largo. Disfruta cada día sin tener que preocuparte por nada.");
    expect(result.notes.join(" ")).toMatch(/cierre .* ✓/);
  });

  it("does not award the closing bonus when none of the three patterns are present", () => {
    const result = analyzeDescription("Texto de relleno suficientemente largo. Un cierre genérico sin ningún patrón reconocido.");
    expect(result.notes.join(" ")).toMatch(/falta cierre/);
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

describe("generic/template phrase penalty", () => {
  // Regression (2026-08-25, PrestaShop test round): real generations opened
  // with clichéd hooks ("Deja atrás las prendas que solo cubren") that say
  // nothing about the specific product — the old scorer had no way to catch
  // this since it only checked structural rules (length, hook_type present),
  // not whether the opening was actually generic.
  it("penalizes a title containing a generic/template phrase", () => {
    const clean = analyzeTitle("Zapatillas Running Amortiguación Premium Soporte Diario y Recuperación Muscular");
    const generic = analyzeTitle("La Mejor Opción en Zapatillas Running para tu Entrenamiento y Recuperación Diaria");
    expect(generic.notes.join(" ")).toMatch(/frase genérica/);
    expect(generic.score).toBeLessThan(clean.score);
  });

  it("penalizes a description whose opening sentence is a generic hook", () => {
    const generic = analyzeDescription(
      "Deja atrás las prendas que solo cubren. El resultado es un estilo renovado para tu día a día."
    );
    expect(generic.notes.join(" ")).toMatch(/apertura genérica/);
  });

  it("does not penalize a specific, non-generic opening", () => {
    const specific = analyzeDescription(
      "Esta chaqueta vaquera oversize incorpora forro sherpa para mantener el calor en climas fríos. El resultado es una prenda cómoda para el uso diario."
    );
    expect(specific.notes.join(" ")).not.toMatch(/apertura genérica/);
  });
});

describe("analyzeBullets redundancy penalty", () => {
  // Distinct bullets covering different aspects of the product — no overlap.
  it("does not penalize bullets that cover distinct topics", () => {
    const result = analyzeBullets([
      "AMORTIGUACIÓN PREMIUM: absorbe el impacto en cada zancada",
      "TRANSPIRABILIDAD: malla que evita el sobrecalentamiento del pie",
      "SUELA ANTIDESLIZANTE: agarre seguro en superficies húmedas",
      "PESO LIGERO: 250g por unidad para carreras de larga distancia",
    ]);
    expect(result.notes.join(" ")).not.toMatch(/similares entre sí/);
  });

  it("penalizes bullets that restate the same idea in different words", () => {
    const result = analyzeBullets([
      "COMODIDAD TOTAL: sensación de confort en cada paso que das",
      "MÁXIMO CONFORT: sensación de comodidad en cada paso que das",
      "ADAPTABILIDAD: se ajusta a distintos ritmos de carrera",
      "USO DIARIO: pensado para entrenamientos regulares",
    ]);
    expect(result.notes.join(" ")).toMatch(/similares entre sí/);
  });
});

describe("analyzeSpecificity", () => {
  it("does not penalize when the product has no confirmed attributes", () => {
    const result = analyzeSpecificity("Copy genérico sin ningún dato concreto del producto.", null);
    expect(result.penalty).toBe(0);
    expect(result.note).toBeNull();
  });

  it("penalizes copy that ignores the product's confirmed attributes", () => {
    const result = analyzeSpecificity(
      "Un producto de altísima calidad, perfecto para el día a día.",
      { color: "Azul marino", material: "Algodón orgánico" }
    );
    expect(result.penalty).toBeGreaterThan(0);
  });

  it("does not penalize copy that reflects the confirmed attributes", () => {
    const result = analyzeSpecificity(
      "Disponible en Azul marino, confeccionado en Algodón orgánico para el uso diario.",
      { color: "Azul marino", material: "Algodón orgánico" }
    );
    expect(result.penalty).toBe(0);
  });
});
