import { PLAN_LIMITS } from "@/lib/constants";

describe("PLAN_LIMITS", () => {
  it("free plan allows 10 listings", () => {
    expect(PLAN_LIMITS.free).toBe(10);
  });

  it("pro plan allows 500 listings", () => {
    expect(PLAN_LIMITS.pro).toBe(500);
  });

  it("enterprise plan is unlimited (Infinity)", () => {
    expect(PLAN_LIMITS.enterprise).toBe(Infinity);
  });

  it("all three plan keys exist", () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(expect.arrayContaining(["free", "pro", "enterprise"]));
  });

  it("enterprise limit is higher than pro", () => {
    expect(PLAN_LIMITS.enterprise).toBeGreaterThan(PLAN_LIMITS.pro);
  });

  it("pro limit is higher than free", () => {
    expect(PLAN_LIMITS.pro).toBeGreaterThan(PLAN_LIMITS.free);
  });
});
