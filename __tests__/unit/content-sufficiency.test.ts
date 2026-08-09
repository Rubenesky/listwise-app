import { hasEnoughContent } from "@/lib/text/content-sufficiency";

describe("hasEnoughContent", () => {
  // Real staging case: olivammarket.com's "Descripción" just repeats the
  // product title (in two different cases) plus WooCommerce boilerplate
  // ("Solo los usuarios registrados...") and a category-navigation list.
  // No real product information beyond the name.
  it("returns false for a source that only repeats the title plus boilerplate/nav", () => {
    const text = [
      "Aceite De Oliva Extra Virgen Bot 500 Ml Olivam",
      "ACEITE DE OLIVA EXTRA VIRGEN BOT 500 ML OLIVAM",
      "Descripción",
      "ACEITE DE OLIVA EXTRA VIRGEN BOT 500 ML OLIVAM",
      "Información adicional",
      "Valoraciones",
      "No hay valoraciones aún.",
      "Solo los usuarios registrados que hayan comprado este producto pueden hacer una valoración.",
      "Acceder / Registro",
      "Alimentos en Conserva",
      "Café e Infusiones",
    ].join("\n");
    expect(hasEnoughContent(text, "Aceite De Oliva Extra Virgen Bot 500 Ml Olivam")).toBe(false);
  });

  it("returns true for a real product page with genuine descriptive sentences", () => {
    const text = [
      "Con un accionamiento ligero este sistema permite regular las lamas, dejándolas en la posición deseada.",
      "Líneas puras y limpias y una gama muy amplia de colores y texturas para orientar la luz solar.",
      "Sistemas de interior e instalación opcional pared o techo, con guías cable disponibles.",
      "Sistema garantizado por 2 años del fabricante de primera línea.",
    ].join("\n");
    expect(hasEnoughContent(text, "Veneciana Aluminio Mate 15mm")).toBe(true);
  });

  it("does not count the same fact repeated in different casing as multiple distinct pieces of content", () => {
    const text = [
      "PRODUCTO GENÉRICO SIN MÁS DATOS",
      "producto genérico sin más datos",
      "Producto Genérico Sin Más Datos",
    ].join("\n");
    expect(hasEnoughContent(text, "")).toBe(false);
  });

  it("returns false for empty or whitespace-only text", () => {
    expect(hasEnoughContent("", "Título")).toBe(false);
    expect(hasEnoughContent("   \n  \n", "Título")).toBe(false);
  });
});
