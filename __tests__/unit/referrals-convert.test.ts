function makeChain(result: unknown[]): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue(result);
  chain.set = jest.fn().mockReturnValue(chain);
  chain.values = jest.fn().mockReturnValue(chain);
  chain.returning = jest.fn().mockResolvedValue([]);
  chain.onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  chain.onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

const mockSelectQueue: unknown[][] = [];

const mockDb = {
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  transaction: jest.fn(),
};

jest.mock("@/db", () => ({
  db: mockDb,
  schema: {
    referrals: { id: "id", status: "status" },
    referralRewards: {},
    users: { id: "id", convertedReferrals: "convertedReferrals" },
    badges: { userId: "userId", type: "type" },
  },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn().mockReturnValue("eq"),
  and: jest.fn().mockReturnValue("and"),
  or: jest.fn().mockReturnValue("or"),
  sql: jest.fn().mockReturnValue("sql_expr"),
}));

jest.mock("uuid", () => ({ v4: jest.fn().mockReturnValue("test-uuid") }));

jest.mock("@/lib/gamification/track", () => ({
  trackGamification: jest.fn().mockResolvedValue(undefined),
}));

import { convertReferral } from "@/lib/referrals/convert";

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectQueue.length = 0;
  mockDb.select.mockImplementation(() => makeChain(mockSelectQueue.shift() ?? []));
  mockDb.update.mockImplementation(() => makeChain([]));
  mockDb.insert.mockImplementation(() => makeChain([]));
  mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb));
});

describe("convertReferral", () => {
  it("returns false when referral is not found", async () => {
    mockSelectQueue.push([]); // no referral
    const result = await convertReferral("ref-not-found", "user-ref", "pro");
    expect(result).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("returns false on self-referral (referrerId === refereeUserId)", async () => {
    mockSelectQueue.push([{ id: "ref-1", referrerId: "same-user", status: "pending" }]);
    const result = await convertReferral("ref-1", "same-user", "pro");
    expect(result).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("returns false when race condition detected (atomic update returns empty)", async () => {
    mockSelectQueue.push([{ id: "ref-1", referrerId: "referrer-1", status: "pending" }]);
    const updateChain = makeChain([]);
    (updateChain.set as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
    });
    mockDb.update.mockReturnValueOnce(updateChain);
    const result = await convertReferral("ref-1", "referee-1", "pro");
    expect(result).toBe(false);
  });

  it("returns true on successful pro conversion", async () => {
    mockSelectQueue.push([{ id: "ref-1", referrerId: "referrer-1", status: "pending" }]);
    const updateChain = makeChain([]);
    (updateChain.set as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: "ref-1" }]) }),
    });
    mockDb.update.mockReturnValueOnce(updateChain);
    mockSelectQueue.push([{ convertedReferrals: 1 }]);
    mockSelectQueue.push([]); // badges
    const result = await convertReferral("ref-1", "referee-1", "pro");
    expect(result).toBe(true);
  });

  it("assigns free_month_enterprise reward for enterprise plan", async () => {
    mockSelectQueue.push([{ id: "ref-2", referrerId: "referrer-2", status: "pending" }]);
    const updateChain = makeChain([]);
    (updateChain.set as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: "ref-2" }]) }),
    });
    mockDb.update.mockReturnValueOnce(updateChain);

    const rewardValuesSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.insert.mockReturnValueOnce({ values: rewardValuesSpy });
    mockSelectQueue.push([{ convertedReferrals: 1 }]);
    mockSelectQueue.push([]);

    await convertReferral("ref-2", "referee-2", "enterprise");
    expect((rewardValuesSpy.mock.calls[0][0] as { type: string }).type).toBe("free_month_enterprise");
  });

  it("assigns free_month_pro reward for non-enterprise plans", async () => {
    mockSelectQueue.push([{ id: "ref-3", referrerId: "referrer-3", status: "pending" }]);
    const updateChain = makeChain([]);
    (updateChain.set as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: "ref-3" }]) }),
    });
    mockDb.update.mockReturnValueOnce(updateChain);

    const rewardValuesSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.insert.mockReturnValueOnce({ values: rewardValuesSpy });
    mockSelectQueue.push([{ convertedReferrals: 1 }]);
    mockSelectQueue.push([]);

    await convertReferral("ref-3", "referee-3", "pro");
    expect((rewardValuesSpy.mock.calls[0][0] as { type: string }).type).toBe("free_month_pro");
  });

  it("awards first_conversion badge at 1 conversion", async () => {
    mockSelectQueue.push([{ id: "ref-4", referrerId: "referrer-4", status: "pending" }]);
    const updateChain = makeChain([]);
    (updateChain.set as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: "ref-4" }]) }),
    });
    mockDb.update.mockReturnValueOnce(updateChain);

    const badgeValuesSpy = jest.fn().mockReturnValue({ onConflictDoNothing: jest.fn().mockResolvedValue(undefined) });
    mockDb.insert
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue(makeChain([])) }) // reward
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue(makeChain([])) }) // referee credits
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue(makeChain([])) }) // referrer counter
      .mockReturnValueOnce({ values: badgeValuesSpy }); // badge insert

    mockSelectQueue.push([{ convertedReferrals: 1 }]);
    mockSelectQueue.push([]); // no badges yet

    await convertReferral("ref-4", "referee-4", "pro");
    const badgeArg = badgeValuesSpy.mock.calls[0][0] as { type: string };
    expect(badgeArg.type).toBe("first_conversion");
  });

  it("returns false and does not throw when an unexpected error occurs", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("DB connection error"); });
    const result = await convertReferral("ref-err", "user-err", "pro");
    expect(result).toBe(false);
  });
});
