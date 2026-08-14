import { buildUserPrompt } from "@/lib/ai/prompts";

// Regression coverage for a real production bug (2026-08-14): CSV-uploaded
// products in the same category all got near-identical opening sentences,
// because REQUIRED_HOOK_TYPE gave the model one literal quoted example to
// copy instead of thematic angles to write from — the model even echoed the
// technique's own label word ("declaración") into the generated copy.
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
