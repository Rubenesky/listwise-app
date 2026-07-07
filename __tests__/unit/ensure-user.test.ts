const mockOnConflictDoNothing = jest.fn().mockResolvedValue(undefined);
const mockValues = jest.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

const mockLimit = jest.fn().mockResolvedValue([]);
const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });

jest.mock("@/db", () => ({
  db: { insert: mockInsert, select: mockSelect },
  schema: { users: {} },
}));

import { ensureUser } from "@/lib/user/ensure-user";

beforeEach(() => {
  jest.clearAllMocks();
  mockOnConflictDoNothing.mockResolvedValue(undefined);
  mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
  mockInsert.mockReturnValue({ values: mockValues });
  mockLimit.mockResolvedValue([]);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
});

describe("ensureUser", () => {
  it("inserts a user row with free-tier defaults", async () => {
    await ensureUser("user-xyz");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-xyz",
        agentCredits: 20,
        agentPlan: "free",
        credits: 0,
      })
    );
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("resolves without throwing (upsert is a no-op when row exists)", async () => {
    await expect(ensureUser("existing-user")).resolves.toBeUndefined();
  });

  it("passes the userId to the insert", async () => {
    await ensureUser("user-abc");
    const insertArg = mockValues.mock.calls[0][0] as { id: string };
    expect(insertArg.id).toBe("user-abc");
  });
});
