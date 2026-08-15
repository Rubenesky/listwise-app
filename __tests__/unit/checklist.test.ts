import { isChecklistStep2Done, isChecklistStep3Done, isChecklistAllDone } from "@/lib/dashboard/checklist";

// Regression coverage for a real bug (2026-08-15): the "Refinar con el
// Agente" step was hardcoded to `done: false` (could never complete), and
// the checklist's visibility was derived from a live listing count that
// could regress back to 0 (e.g. listings deleted), resurrecting the
// checklist for an account that had clearly already onboarded.

describe("isChecklistStep2Done", () => {
  it("is false when neither the sticky flag nor a live listing exists", () => {
    expect(isChecklistStep2Done({ everUploaded: false, currentCount: 0 })).toBe(false);
  });

  it("is true from a live listing even before the sticky flag catches up", () => {
    expect(isChecklistStep2Done({ everUploaded: false, currentCount: 1 })).toBe(true);
  });

  it("stays true via the sticky flag even if the live count regresses to 0 (listings deleted)", () => {
    expect(isChecklistStep2Done({ everUploaded: true, currentCount: 0 })).toBe(true);
  });
});

describe("isChecklistStep3Done", () => {
  it("is false until the user has actually used the Agent", () => {
    expect(isChecklistStep3Done({ usedAgent: false })).toBe(false);
  });

  it("is true once the user has used the Agent — not hardcoded false regardless of input", () => {
    expect(isChecklistStep3Done({ usedAgent: true })).toBe(true);
  });
});

describe("isChecklistAllDone", () => {
  it("is false when only step 2 is done", () => {
    expect(isChecklistAllDone({ everUploaded: true, currentCount: 0, usedAgent: false })).toBe(false);
  });

  it("is false when only step 3 is done", () => {
    expect(isChecklistAllDone({ everUploaded: false, currentCount: 0, usedAgent: true })).toBe(false);
  });

  it("is true only once both steps 2 and 3 are done", () => {
    expect(isChecklistAllDone({ everUploaded: true, currentCount: 0, usedAgent: true })).toBe(true);
  });

  it("stays true even if currentCount later regresses to 0, via the sticky flags", () => {
    expect(isChecklistAllDone({ everUploaded: true, currentCount: 0, usedAgent: true })).toBe(true);
  });
});
