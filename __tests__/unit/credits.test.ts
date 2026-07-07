import { useCredits, addCredits } from "@/lib/credits/use-credits";

// ─── DB mock ─────────────────────────────────────────────────────────────────

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockSelect }) }) }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    }),
    transaction: (fn: (tx: object) => Promise<unknown>) => mockTransaction(fn),
  },
  schema: {
    users: { id: "id", agentCredits: "agent_credits", agentPlan: "agent_plan" },
    creditTransactions: {},
  },
}));

jest.mock("@/lib/user/ensure-user", () => ({
  ensureUser: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockUser(plan: string | null, credits: number) {
  mockSelect.mockResolvedValue([{ agentPlan: plan, agentCredits: credits }]);
  mockUpdate.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (tx: object) => Promise<unknown>) => {
    const tx = {
      update: () => ({ set: () => ({ where: mockUpdate }) }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    return fn(tx);
  });
});

// ─── useCredits ───────────────────────────────────────────────────────────────

describe("useCredits", () => {
  it("deducts credits and returns success for free user with enough credits", async () => {
    mockUser("free", 10);
    const result = await useCredits("user_123", 3, "test");
    expect(result.success).toBe(true);
    expect(result.remainingCredits).toBe(7);
    expect(result.error).toBeUndefined();
  });

  it("blocks a free user with insufficient credits", async () => {
    mockUser("free", 2);
    const result = await useCredits("user_123", 5, "test");
    expect(result.success).toBe(false);
    expect(result.remainingCredits).toBe(2);
    expect(result.error).toBe("insufficient");
  });

  it("allows a free user to use exactly their remaining credits", async () => {
    mockUser("free", 5);
    const result = await useCredits("user_123", 5, "test");
    expect(result.success).toBe(true);
    expect(result.remainingCredits).toBe(0);
  });

  it("never blocks a pro user even with 0 credits", async () => {
    mockUser("pro", 0);
    const result = await useCredits("user_pro", 10, "test");
    expect(result.success).toBe(true);
  });

  it("never blocks an enterprise user even with 0 credits", async () => {
    mockUser("enterprise", 0);
    const result = await useCredits("user_ent", 10, "test");
    expect(result.success).toBe(true);
  });

  it("returns user_not_found when user row is missing", async () => {
    mockSelect.mockResolvedValue([]);
    const result = await useCredits("ghost_user", 1, "test");
    expect(result.success).toBe(false);
    expect(result.error).toBe("user_not_found");
  });

  it("treats null agentPlan as free and blocks if credits insufficient", async () => {
    mockUser(null, 0);
    const result = await useCredits("user_123", 1, "test");
    expect(result.success).toBe(false);
    expect(result.error).toBe("insufficient");
  });
});

// ─── addCredits ───────────────────────────────────────────────────────────────

describe("addCredits", () => {
  it("resolves without throwing", async () => {
    mockUpdate.mockResolvedValue(undefined);
    await expect(
      addCredits("user_123", 50, "purchase", "Pack 50 créditos", "sess_abc")
    ).resolves.toBeUndefined();
  });
});
