// Thenable chain — works for both `await chain.where()` and `await chain.where().limit()`
function makeChain(result: unknown[]): Record<string, jest.Mock | ((resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise<unknown>)> {
  const chain: Record<string, unknown> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue(result);
  chain.set = jest.fn().mockReturnValue(chain);
  chain.values = jest.fn().mockReturnValue(chain);
  chain.returning = jest.fn().mockResolvedValue([]);
  chain.onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as Record<string, jest.Mock | ((resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise<unknown>)>;
}

const mockSelectQueue: unknown[][] = [];

const mockDb = {
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
};

jest.mock("@/db", () => ({
  db: mockDb,
  schema: {
    gamificationHistory: { userId: "userId", action: "action", createdAt: "createdAt" },
    gamification: { userId: "userId" },
  },
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn().mockReturnValue("eq"),
  and: jest.fn().mockReturnValue("and"),
  count: jest.fn().mockReturnValue("count()"),
  sql: jest.fn().mockReturnValue("sql_expr"),
}));

jest.mock("uuid", () => ({ v4: jest.fn().mockReturnValue("test-uuid") }));

import { trackGamification } from "@/lib/gamification/track";

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectQueue.length = 0;
  mockDb.select.mockImplementation(() => makeChain(mockSelectQueue.shift() ?? []));
  mockDb.update.mockImplementation(() => makeChain([]));
  mockDb.insert.mockImplementation(() => makeChain([]));
});

describe("trackGamification", () => {
  it("returns early for unknown action without touching DB", async () => {
    await trackGamification("user-1", "nonexistent_action");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns early when daily limit is reached", async () => {
    mockSelectQueue.push([{ n: 10 }]); // count = pro limit for upload_csv
    await trackGamification("user-1", "upload_csv");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("updates points when existing record is found", async () => {
    const existingRecord = {
      id: "gam-1", userId: "user-1", points: 0, level: 1,
      badges: "[]", streak: 0, lastActivity: 0, updatedAt: 0,
    };
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([existingRecord]);

    await trackGamification("user-1", "generate_product");

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("inserts a new gamification record when none exists", async () => {
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([]); // no existing record

    await trackGamification("user-1", "generate_product");

    // First insert = create gamification record, second = history
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("awards first_product badge on generate_product action", async () => {
    const existingRecord = {
      id: "gam-1", userId: "user-2", points: 0, level: 1,
      badges: "[]", streak: 0, lastActivity: 0, updatedAt: 0,
    };
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([existingRecord]);

    const updateSetSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.update.mockReturnValueOnce({ set: updateSetSpy });

    await trackGamification("user-2", "generate_product");

    const setArg = updateSetSpy.mock.calls[0][0] as { badges: string };
    const badges = JSON.parse(setArg.badges);
    expect(badges).toContain("first_product");
  });

  it("awards sharer badge on share_landing action", async () => {
    const existingRecord = {
      id: "gam-2", userId: "user-3", points: 10, level: 1,
      badges: "[]", streak: 1, lastActivity: 0, updatedAt: 0,
    };
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([existingRecord]);

    const updateSetSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.update.mockReturnValueOnce({ set: updateSetSpy });

    await trackGamification("user-3", "share_landing");

    const setArg = updateSetSpy.mock.calls[0][0] as { badges: string };
    expect(JSON.parse(setArg.badges)).toContain("sharer");
  });

  it("does not duplicate badges already earned", async () => {
    const existingRecord = {
      id: "gam-3", userId: "user-4", points: 0, level: 1,
      badges: JSON.stringify(["first_product"]),
      streak: 1, lastActivity: 0, updatedAt: 0,
    };
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([existingRecord]);

    const updateSetSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.update.mockReturnValueOnce({ set: updateSetSpy });

    await trackGamification("user-4", "generate_product");

    const setArg = updateSetSpy.mock.calls[0][0] as { badges: string };
    const badges = JSON.parse(setArg.badges);
    expect(badges.filter((b: string) => b === "first_product")).toHaveLength(1);
  });

  it("awards ai_user badge on agent_chat action", async () => {
    const existingRecord = {
      id: "gam-5", userId: "user-5", points: 5, level: 1,
      badges: "[]", streak: 1, lastActivity: 0, updatedAt: 0,
    };
    mockSelectQueue.push([{ n: 0 }]);
    mockSelectQueue.push([existingRecord]);

    const updateSetSpy = jest.fn().mockReturnValue(makeChain([]));
    mockDb.update.mockReturnValueOnce({ set: updateSetSpy });

    await trackGamification("user-5", "agent_chat");

    const setArg = updateSetSpy.mock.calls[0][0] as { badges: string };
    expect(JSON.parse(setArg.badges)).toContain("ai_user");
  });
});
