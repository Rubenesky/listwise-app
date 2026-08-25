// __tests__/unit/stripe-webhook-subscription-route.test.ts
// Focused on the two behaviors added/changed 2026-08-25: the
// customer.subscription.updated handler (tracks cancel_at_period_end) and
// the Clerk metadata sync added to customer.subscription.deleted (without
// it, useUserPlan() kept reading the stale paid plan forever after a real
// cancellation — see src/lib/hooks/useUserPlan.ts).
import { POST } from "@/app/api/stripe/webhook/route";

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue(new Map([["stripe-signature", "sig_test"]])),
}));

const mockConstructEvent = jest.fn();
jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

jest.mock("@/lib/redis", () => ({ redis: { set: jest.fn().mockResolvedValue(true) } }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("@/lib/email/templates", () => ({
  churnPreventionTemplate: jest.fn().mockReturnValue("<p>churn email</p>"),
}));
jest.mock("@/lib/referrals/convert", () => ({ convertReferral: jest.fn() }));
jest.mock("@/lib/credits/use-credits", () => ({ addCredits: jest.fn() }));
jest.mock("@/lib/stripe/price-plan", () => ({ planFromPriceId: jest.fn(), parseAgentCredits: jest.fn() }));
jest.mock("@/lib/user/ensure-user", () => ({ ensureUser: jest.fn() }));
jest.mock("@/lib/gamification/track", () => ({ trackGamification: jest.fn() }));

const mockUpdateSet = jest.fn();
const mockGetUser = jest.fn();
const mockUpdateUserMetadata = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      updateUserMetadata: (...args: unknown[]) => mockUpdateUserMetadata(...args),
    },
  }),
}));

const mockSubscriptionSelect = jest.fn();
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: mockSubscriptionSelect }) }),
    })),
    update: jest.fn(() => ({
      set: (...args: unknown[]) => { mockUpdateSet(...args); return { where: jest.fn() }; },
    })),
  },
  schema: { subscriptions: {} },
}));

function makeRequest(): Request {
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" });
}

describe("POST /api/stripe/webhook — customer.subscription.updated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateSet.mockClear();
  });

  it("stores cancel_at_period_end when Stripe schedules a cancellation", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_123", cancel_at_period_end: true } },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ cancelAtPeriodEnd: 1 }));
  });

  it("clears cancel_at_period_end when a scheduled cancellation is undone", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_123", cancel_at_period_end: false } },
    });

    await POST(makeRequest());
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ cancelAtPeriodEnd: 0 }));
  });
});

describe("POST /api/stripe/webhook — customer.subscription.deleted syncs Clerk metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateSet.mockClear();
    mockSubscriptionSelect.mockResolvedValue([{ id: "sub-row-1", userId: "user-1", plan: "pro" }]);
    mockGetUser.mockResolvedValue({
      firstName: "Ada",
      publicMetadata: { plan: "pro" },
      emailAddresses: [{ emailAddress: "ada@example.com" }],
    });
  });

  it("resets Clerk publicMetadata.plan to free so useUserPlan() stops reading the stale paid plan", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_123" } },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ publicMetadata: expect.objectContaining({ plan: "free" }) })
    );
  });

  it("still cancels the subscription in the DB even if the Clerk metadata sync fails", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Clerk down"));
    mockConstructEvent.mockReturnValue({
      id: "evt_4",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_123" } },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled", cancelAtPeriodEnd: 0 })
    );
  });
});
