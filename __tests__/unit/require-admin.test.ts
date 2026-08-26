import { auth } from "@clerk/nextjs/server";
import { requireAdmin, isAdmin } from "@/lib/auth/require-admin";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
const mockAuth = auth as unknown as jest.Mock;

describe("requireAdmin", () => {
  const originalAdminId = process.env.ADMIN_USER_ID;

  afterEach(() => {
    process.env.ADMIN_USER_ID = originalAdminId;
  });

  it("returns null (allows the request through) when userId matches ADMIN_USER_ID", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: "admin-123" });
    const result = await requireAdmin();
    expect(result).toBeNull();
  });

  it("returns a 403 response when there is no authenticated user", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: null });
    const result = await requireAdmin();
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    const body = await result?.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("returns a 403 response when the authenticated user is not the admin", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: "someone-else" });
    const result = await requireAdmin();
    expect(result?.status).toBe(403);
  });

  // Regression: if ADMIN_USER_ID is ever unset in an environment, the naive
  // check `userId === adminId` would only fail when userId is falsy — but
  // a signed-in user with userId === "" (or any environment where adminId
  // resolves to the same falsy-ish empty string) must still be denied.
  // requireAdmin explicitly guards on `!adminId`, not just the equality.
  it("returns a 403 response when ADMIN_USER_ID is unset, even if a user is authenticated", async () => {
    delete process.env.ADMIN_USER_ID;
    mockAuth.mockResolvedValue({ userId: "someone" });
    const result = await requireAdmin();
    expect(result?.status).toBe(403);
  });
});

describe("isAdmin", () => {
  const originalAdminId = process.env.ADMIN_USER_ID;

  afterEach(() => {
    process.env.ADMIN_USER_ID = originalAdminId;
  });

  it("returns true when userId matches ADMIN_USER_ID", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: "admin-123" });
    expect(await isAdmin()).toBe(true);
  });

  it("returns false when there is no authenticated user", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: null });
    expect(await isAdmin()).toBe(false);
  });

  it("returns false when the authenticated user is not the admin", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    mockAuth.mockResolvedValue({ userId: "someone-else" });
    expect(await isAdmin()).toBe(false);
  });

  it("returns false when ADMIN_USER_ID is unset, even if a user is authenticated", async () => {
    delete process.env.ADMIN_USER_ID;
    mockAuth.mockResolvedValue({ userId: "someone" });
    expect(await isAdmin()).toBe(false);
  });
});
