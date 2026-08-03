import { hasSections, parseDescriptionSections } from "@/lib/listings/render-sections";

describe("hasSections", () => {
  it("returns false for a plain short-mode description", () => {
    expect(hasSections("Un párrafo normal.\n\nOtro párrafo sin marcadores.")).toBe(false);
  });

  it("returns true when a ## marker is present", () => {
    expect(hasSections("Intro.\n\n## Especificaciones técnicas\nDetalle.")).toBe(true);
  });
});

describe("parseDescriptionSections", () => {
  it("returns a single section with heading null for plain text (backward compatible)", () => {
    const text = "Un párrafo normal.\n\nOtro párrafo sin marcadores.";
    const sections = parseDescriptionSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
    expect(sections[0].body).toBe(text);
  });

  it("splits into intro + sections when markers are present", () => {
    const text = [
      "Gancho breve.",
      "",
      "## Especificaciones técnicas",
      "Material: aluminio. Medidas: 120x150cm.",
      "",
      "## Instalación",
      "Paso 1. Paso 2.",
      "",
      "## Preguntas frecuentes",
      "¿Cuánto tarda? 2 semanas.",
    ].join("\n");

    const sections = parseDescriptionSections(text);

    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toBeNull();
    expect(sections[0].body).toBe("Gancho breve.");
    expect(sections[1].heading).toBe("Especificaciones técnicas");
    expect(sections[1].body).toBe("Material: aluminio. Medidas: 120x150cm.");
    expect(sections[2].heading).toBe("Instalación");
    expect(sections[3].heading).toBe("Preguntas frecuentes");
  });
});
