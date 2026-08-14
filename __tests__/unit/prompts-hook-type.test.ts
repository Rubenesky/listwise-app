import { buildUserPrompt, buildSystemPrompt } from "@/lib/ai/prompts";

// Regression coverage for a real production bug (2026-08-14): CSV-uploaded
// products in the same category all got near-identical opening sentences,
// because REQUIRED_HOOK_TYPE gave the model one literal quoted example to
// copy instead of thematic angles to write from — the model even echoed the
// technique's own label word ("declaración") into the generated copy.
//
// A first fix only touched REQUIRED_HOOK_TYPE and did NOT resolve it: three
// of four re-tested products still opened with "Esto no es [producto] más.
// Es una declaración de..." — because SYSTEM_PROMPT itself has two static
// blocks (the "tipos de apertura" list and CONTRAST FRAME) with the exact
// same literal quotable example, present for every product regardless of
// category. The tests below cover both the per-category and the static
// sources of the bug.
const CATEGORIES_WITH_REQUIRED_HOOK = [
  "Ropa", "Moda", "Deportes", "Deporte Extremo", "Electrónica", "Cocina",
  "Hogar", "Iluminación", "Belleza", "Bienestar", "Salud", "Bebé",
  "Mascotas", "Accesorios", "Oficina", "Jardín", "Juguetes", "Automóvil",
  "POD", "Boda", "Navidad",
];

describe("buildUserPrompt hook-type instructions", () => {
  it.each(CATEGORIES_WITH_REQUIRED_HOOK)(
    "gives thematic angles (not a copyable literal example) for category %s",
    (category) => {
      const prompt = buildUserPrompt({ productName: "Producto de prueba", category, mode: "creative" });
      expect(prompt).toContain("Ángulos:");
      // The exact phrase from the real bug report must never resurface.
      expect(prompt).not.toContain("Esto no es otra");
      expect(prompt).not.toMatch(/¿Cuántas (veces|noches) has \[/); // old bracket-template question format
      expect(prompt).not.toMatch(/Son las \[hora\]/); // old bracket-template scene format
    }
  );

  it("appends the anti-copy / anti-repetition guardrail whenever a hook type is required", () => {
    const prompt = buildUserPrompt({ productName: "Mochila urbana", category: "Ropa", mode: "creative" });
    expect(prompt).toContain("redacta tu propia frase original");
    expect(prompt).toContain("no repitas siempre el mismo ángulo");
  });

  it("does not inject any hook-type block for a category with no prescribed hook", () => {
    const prompt = buildUserPrompt({ productName: "Producto genérico", category: "General", mode: "creative" });
    expect(prompt).not.toContain("Tipo de apertura OBLIGATORIO");
    expect(prompt).not.toContain("Ángulos:");
  });
});

describe("SYSTEM_PROMPT static templates (present for every product, any category)", () => {
  const systemPrompt = buildSystemPrompt("creative");

  it("no longer contains the old literal quoted hook examples", () => {
    expect(systemPrompt).not.toContain('"Esto no es otra [cliché de la categoría]. Y lo notas desde el primer uso."');
    expect(systemPrompt).not.toContain('"No es [cliché de la categoría]. Es [beneficio único concreto]."');
  });

  it("explicitly bans the word \"declaración\" anywhere in the description", () => {
    expect(systemPrompt).toContain('PROHIBIDO en cualquier parte de la descripción: la palabra "declaración"');
  });

  it("bans \"Esto no es\" as an opening construction", () => {
    expect(systemPrompt).toContain('"Esto no es"');
  });

  it("includes the AUTOVERIFICACION check for the exact bug pattern", () => {
    expect(systemPrompt).toContain('¿La descripción usa la construcción "Esto no es [producto] más. Es una declaración de..." o contiene la palabra "declaración" en cualquier parte?');
  });
});
