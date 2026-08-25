import { PUBLIC_ROUTE_PATTERNS } from "@/middleware";

describe("middleware public routes", () => {
  // Regression (2026-08-25): /api/leads and /api/cron/* authenticate via
  // their own internal checks (rate-limit-by-IP, x-cron-secret header), not
  // Clerk sessions — but were missing from this list, so every unauthenticated
  // call was 307-redirected to /sign-in before reaching the route handler.
  // Lead capture and the re-engagement/activation-nudge crons were silently
  // broken because of this, unrelated to any bug in their own code.
  it("keeps /api/leads public — it's authenticated by IP rate-limit, not Clerk", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/api/leads(.*)");
  });

  it("keeps /api/cron public — cron routes authenticate via x-cron-secret, not Clerk", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/api/cron(.*)");
  });

  it("keeps the Stripe and Clerk webhook endpoints public — external services can't hold a Clerk session", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/api/stripe/webhook(.*)");
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/api/webhooks/clerk(.*)");
  });
});
