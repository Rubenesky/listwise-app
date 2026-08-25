// __tests__/unit/stripe-create-portal-session-route.test.ts
import { POST } from "@/app/api/stripe/create-portal-session/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ratelimitPortalSession: { limit: jest.fn() },
}));

const mockSubscriptionSelect = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockSubscriptionSelect }) }),
    })),
  },
  schema: { subscriptions: {} },
}));

const mockCreatePortalSession = jest.fn();
jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    billingPortal: { sessions: { create: mockCreatePortalSession } },
  })),
}));

import { auth } from "@clerk/nextjs/server";
import { ratelimitPortalSession } from "@/lib/rate-limit";

function makeRequest(): Request {
  return new Request("http://localhost/api/stripe/create-portal-session", { method: "POST" });
}

describe("POST /api/stripe/create-portal-session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitPortalSession.limit as jest.Mock).mockResolvedValue({ success: true });
    mockSubscriptionSelect.mockResolvedValue([{ stripeCustomerId: "cus_123" }]);
    mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session/xyz" });
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
    expect(mockCreatePortalSession).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    (ratelimitPortalSession.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST();
    expect(res.status).toBe(429);
    expect(mockCreatePortalSession).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no subscription row (no stripeCustomerId to open a portal for)", async () => {
    mockSubscriptionSelect.mockResolvedValue([]);
    const res = await POST();
    expect(res.status).toBe(404);
    expect(mockCreatePortalSession).not.toHaveBeenCalled();
  });

  it("creates a portal session for the user's Stripe customer and returns its URL", async () => {
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.com/session/xyz");
    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123" })
    );
  });

  it("returns 500 and does not crash when Stripe throws", async () => {
    mockCreatePortalSession.mockRejectedValue(new Error("Stripe down"));
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
