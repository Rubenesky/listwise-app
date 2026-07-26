import { mergeAttributesWithPrecedence } from "@/lib/listings/merge-attributes";

describe("mergeAttributesWithPrecedence", () => {
  it("fills gaps from extracted specs when manual attributes lack them", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      { color: "blanco" },
      { material: "aluminio", medidas: "120x80cm" }
    );
    expect(merged).toEqual({ color: "blanco", material: "aluminio", medidas: "120x80cm" });
    expect(conflicts).toEqual([]);
  });

  it("manual value always wins on key conflict, and records the conflict", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(
      { material: "PVC" },
      { material: "aluminio" }
    );
    expect(merged.material).toBe("PVC");
    expect(conflicts).toEqual([{ key: "material", manualValue: "PVC", extractedValue: "aluminio" }]);
  });

  it("handles null manual attributes", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence(null, { material: "aluminio" });
    expect(merged).toEqual({ material: "aluminio" });
    expect(conflicts).toEqual([]);
  });

  it("handles null extracted specs", () => {
    const { merged, conflicts } = mergeAttributesWithPrecedence({ color: "blanco" }, null);
    expect(merged).toEqual({ color: "blanco" });
    expect(conflicts).toEqual([]);
  });
});
