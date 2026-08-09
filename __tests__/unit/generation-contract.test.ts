import { meetsContentContract, generateWithContentRetry } from "@/lib/ai/generation-contract";

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

// Regression: the retry orchestration in process-products.ts (call AI, check
// meetsContentContract, retry once on a miss, accept the last result
// regardless) had no test coverage — the trigger job itself pulls in
// @trigger.dev/sdk, the DB, and the AI provider, none of which are mocked
// anywhere in this codebase's test suite. Extracting the loop as a pure,
// callback-driven helper makes the retry *decision* testable without adding
// a new mocking pattern for Trigger.dev jobs.
describe("generateWithContentRetry", () => {
  it("calls generate only once when the first result already meets the contract", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a", "b", "c", "d"], description: words(120) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.bullets.length).toBe(4);
  });

  it("retries once and returns the second result when the first misses the contract", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ bullets: ["a", "b", "c"], description: words(150) })
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.bullets.length).toBe(4);
  });

  it("stops after maxAttempts and returns the last result even if still insufficient", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a", "b", "c"], description: words(150) });
    const result = await generateWithContentRetry(generate, 2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.bullets.length).toBe(3); // accepted anyway — no listing left without content
  });

  it("never retries when maxAttempts is 1, regardless of content sufficiency", async () => {
    const generate = jest.fn().mockResolvedValue({ bullets: ["a"], description: words(10) });
    await generateWithContentRetry(generate, 1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry with the attempt number and the failing result before retrying", async () => {
    const insufficientResult = { bullets: ["a", "b", "c"], description: words(150) };
    const generate = jest
      .fn()
      .mockResolvedValueOnce(insufficientResult)
      .mockResolvedValueOnce({ bullets: ["a", "b", "c", "d"], description: words(150) });
    const onRetry = jest.fn();
    await generateWithContentRetry(generate, 2, onRetry);
    expect(onRetry).toHaveBeenCalledWith(1, insufficientResult);
  });
});
