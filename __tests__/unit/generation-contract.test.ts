import { meetsContentContract } from "@/lib/ai/generation-contract";

function words(n: number): string {
  return Array(n).fill("palabra").join(" ");
}

describe("meetsContentContract", () => {
  it("passes when bullets >= 4 and description >= 120 words", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(120) })).toBe(true);
  });

  // Regression: real generation for auriculares/plastic.es (thin-attributes
  // source) produced only 3 bullets, violating the prompt's own "nunca menos
  // de 4" rule — this is exactly the case the retry loop in
  // process-products.ts exists to catch and re-attempt.
  it("fails when bullets < 4, even with a long enough description", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c"], description: words(150) })).toBe(false);
  });

  it("fails when description is under 120 words, even with enough bullets", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(80) })).toBe(false);
  });

  it("passes with more than 4 bullets", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d", "e", "f"], description: words(200) })).toBe(true);
  });

  it("treats exactly 120 words as sufficient (inclusive boundary)", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(120) })).toBe(true);
  });

  it("treats 119 words as insufficient", () => {
    expect(meetsContentContract({ bullets: ["a", "b", "c", "d"], description: words(119) })).toBe(false);
  });
});
