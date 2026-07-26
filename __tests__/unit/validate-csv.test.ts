import { validateRows, isValidPrice } from "@/lib/csv/validate-rows";

describe("isValidPrice", () => {
  it("accepts integer prices", () => {
    expect(isValidPrice("100")).toBe(true);
    expect(isValidPrice("29")).toBe(true);
  });

  it("accepts decimal prices with dot", () => {
    expect(isValidPrice("29.99")).toBe(true);
    expect(isValidPrice("9.95")).toBe(true);
  });

  it("accepts decimal prices with comma", () => {
    expect(isValidPrice("29,99")).toBe(true);
  });

  it("accepts prices with currency symbols", () => {
    expect(isValidPrice("29,99€")).toBe(true);
    expect(isValidPrice("€29.99")).toBe(true);
    expect(isValidPrice("$9.99")).toBe(true);
  });

  it("rejects non-numeric prices", () => {
    expect(isValidPrice("abc")).toBe(false);
    expect(isValidPrice("precio")).toBe(false);
  });

  it("rejects prices with letters mixed in", () => {
    expect(isValidPrice("12euros99")).toBe(false);
    expect(isValidPrice("price:29")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidPrice("")).toBe(false);
  });
});

describe("validateRows", () => {
  it("returns no errors on empty records", () => {
    const { errors, warnings } = validateRows([]);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("errors when productName column is missing", () => {
    const { errors } = validateRows([{ nombre: "Test" }]);
    expect(errors).toContain('El CSV debe incluir la columna "productName"');
  });

  it("passes with a valid productName", () => {
    const { errors } = validateRows([{ productName: "Camiseta azul talla M" }]);
    expect(errors).toHaveLength(0);
  });

  it("errors on empty productName", () => {
    const { errors } = validateRows([{ productName: "   " }]);
    expect(errors.some((e) => e.includes("obligatorio"))).toBe(true);
  });

  it("errors on productName over 500 chars", () => {
    const { errors } = validateRows([{ productName: "a".repeat(501) }]);
    expect(errors.some((e) => e.includes("demasiado largo"))).toBe(true);
  });

  it("does not error on productName exactly 500 chars", () => {
    const { errors } = validateRows([{ productName: "a".repeat(500) }]);
    expect(errors).toHaveLength(0);
  });

  it("errors on invalid price format", () => {
    const { errors } = validateRows([{ productName: "Test", price: "veinte euros" }]);
    expect(errors.some((e) => e.includes("precio no válido"))).toBe(true);
  });

  it("does not error on valid price format", () => {
    const { errors } = validateRows([{ productName: "Test", price: "29.99" }]);
    expect(errors).toHaveLength(0);
  });

  it("warns on unrecognized category (non-blocking)", () => {
    const { errors, warnings } = validateRows([
      { productName: "Test", category: "categoria_inexistente_xyz" },
    ]);
    expect(errors).toHaveLength(0);
    expect(warnings.some((w) => w.includes("se procesará igualmente"))).toBe(true);
  });

  it("does not warn on recognized category", () => {
    const { warnings } = validateRows([{ productName: "Test", category: "ropa" }]);
    expect(warnings).toHaveLength(0);
  });

  it("warns on invalid JSON attributes (non-blocking)", () => {
    const { errors, warnings } = validateRows([
      { productName: "Test", attributes: "{invalid json" },
    ]);
    expect(errors).toHaveLength(0);
    expect(warnings.some((w) => w.includes("JSON válido"))).toBe(true);
  });

  it("does not warn on valid JSON attributes", () => {
    const { warnings } = validateRows([
      { productName: "Test", attributes: '{"color":"rojo","talla":"M"}' },
    ]);
    expect(warnings).toHaveLength(0);
  });

  it("validates multiple rows and accumulates errors", () => {
    const records = [
      { productName: "" },
      { productName: "   " },
      { productName: "Válido" },
    ];
    const { errors } = validateRows(records);
    expect(errors).toHaveLength(2);
  });

  it("caps errors at MAX_ERRORS and appends summary message", () => {
    const records = Array.from({ length: 25 }, () => ({ productName: "" }));
    const { errors } = validateRows(records);
    expect(errors.length).toBeLessThanOrEqual(22);
    expect(errors[errors.length - 1]).toContain("y más errores");
  });

  it("warns (does not error) on a malformed sourceUrl", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "not-a-url" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("sourceUrl"))).toBe(true);
  });

  it("warns on a non-http(s) sourceUrl scheme", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "ftp://example.com/file" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("sourceUrl"))).toBe(true);
  });

  it("accepts a valid https sourceUrl without warnings", () => {
    const { errors, warnings } = validateRows([
      { productName: "Persiana", sourceUrl: "https://proveedor.com/ficha" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
