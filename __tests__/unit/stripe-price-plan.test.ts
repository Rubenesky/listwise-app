import { planFromPriceId, parseAgentCredits, PRICE_TO_PLAN } from "@/lib/stripe/price-plan";

describe("planFromPriceId", () => {
  it("returns pro for known pro price IDs", () => {
    expect(planFromPriceId("price_1Tl68X1uySlskct3CuBf7pjw")).toBe("pro");
    expect(planFromPriceId("price_1TncET1uySlskct3tPbtAzJA")).toBe("pro");
  });

  it("returns enterprise for known enterprise price IDs", () => {
    expect(planFromPriceId("price_1Tl69t1uySlskct3TIl1qBqc")).toBe("enterprise");
    expect(planFromPriceId("price_1TncFM1uySlskct3Lin2vkKE")).toBe("enterprise");
  });

  it("returns null for unknown price ID", () => {
    expect(planFromPriceId("price_unknown_xyz")).toBeNull();
    expect(planFromPriceId("")).toBeNull();
  });

  it("covers all entries in PRICE_TO_PLAN", () => {
    for (const [priceId, plan] of Object.entries(PRICE_TO_PLAN)) {
      expect(planFromPriceId(priceId)).toBe(plan);
    }
  });
});

describe("parseAgentCredits", () => {
  it("returns 0 when type is not agent_credits", () => {
    expect(parseAgentCredits({ type: "subscription" })).toBe(0);
    expect(parseAgentCredits({})).toBe(0);
  });

  it("parses credits from metadata when type is agent_credits", () => {
    expect(parseAgentCredits({ type: "agent_credits", credits: "50" })).toBe(50);
    expect(parseAgentCredits({ type: "agent_credits", credits: "100" })).toBe(100);
  });

  it("returns 0 when credits is missing", () => {
    expect(parseAgentCredits({ type: "agent_credits" })).toBe(0);
  });

  it("returns 0 when credits is NaN", () => {
    expect(parseAgentCredits({ type: "agent_credits", credits: "abc" })).toBe(0);
  });

  it("returns 0 for negative credits (tamper protection)", () => {
    expect(parseAgentCredits({ type: "agent_credits", credits: "-50" })).toBe(0);
  });

  it("returns 0 when credits is 0", () => {
    expect(parseAgentCredits({ type: "agent_credits", credits: "0" })).toBe(0);
  });
});
