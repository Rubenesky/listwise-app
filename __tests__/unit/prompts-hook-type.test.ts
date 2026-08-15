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
// category.
//
// A second fix banned the specific words ("Esto no es", "declaración") and
// STILL did not fully resolve it: two of four re-tested products dodged the
// word-level ban while keeping the same grammatical shape ("Un bolso no es
// solo un contenedor; es...", "No es solo una mochila...; es..."). The real
// fix bans the STRUCTURE "[algo] no es X; es Y" in any phrasing, not just
// specific tokens. The tests below cover the per-category, static, and
// structural sources of the bug.
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

  it("includes the AUTOVERIFICACION check for the structural pattern, not just specific words", () => {
    expect(systemPrompt).toContain('¿Alguna frase de la descripción tiene la forma "[algo] no es X; es Y" — con CUALQUIER fraseo o sujeto, no solo "Esto no es"');
  });

  it("bans the [algo] no es X; es Y structure in any phrasing, in the hook-type list and CONTRAST FRAME", () => {
    expect(systemPrompt).toContain('PROHIBIDO usar la forma "[algo] no es X; es Y" en cualquier fraseo (esto incluye variantes como "Un bolso no es solo...", "No es solo una mochila..." — no solo "Esto no es...")');
  });
});

describe("REQUIRED_HOOK_TYPE 'bold' categories (Ropa, Moda, Accesorios, POD)", () => {
  it.each(["Ropa", "Moda", "Accesorios", "POD"])(
    "bans the [algo] no es X; es Y structure and drops the risky 'negar directamente' angle for %s",
    (category) => {
      const prompt = buildUserPrompt({ productName: "Producto de prueba", category, mode: "creative" });
      expect(prompt).toMatch(/SIN usar la forma "\[algo\] no es X; es Y"/);
      // The old angle phrasing that led the model straight to "X no es Y; es Z"
      // must be gone — replaced by an imperative/direct-affirmation angle.
      expect(prompt).not.toMatch(/Ángulos:\s*negar (el cliché( directamente)?|lo predecible),/);
    }
  );
});
