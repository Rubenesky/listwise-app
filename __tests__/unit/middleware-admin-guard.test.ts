import { NextRequest, NextResponse } from "next/server";
import { middlewareHandler, PUBLIC_ROUTE_PATTERNS } from "@/middleware";

function makeAuth(userId: string | null) {
  return (async () => ({ userId })) as never;
}

function makeReq(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("middleware admin guard (defense in depth for /admin/*)", () => {
  const originalAdminId = process.env.ADMIN_USER_ID;
  afterEach(() => {
    process.env.ADMIN_USER_ID = originalAdminId;
  });

  it("does not list /admin as public — an unauthenticated user must hit the sign-in redirect first", () => {
    expect(PUBLIC_ROUTE_PATTERNS.some((p) => p.startsWith("/admin"))).toBe(false);
  });

  it("redirects an unauthenticated user hitting /admin to sign-in", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    const res = (await middlewareHandler(makeAuth(null), makeReq("/admin/insights"))) as NextResponse;
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("redirects an authenticated non-admin away from /admin to /dashboard", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    const res = (await middlewareHandler(makeAuth("someone-else"), makeReq("/admin/insights"))) as NextResponse;
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("lets an authenticated admin through to /admin routes", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    const res = (await middlewareHandler(makeAuth("admin-123"), makeReq("/admin/insights"))) as NextResponse;
    expect(res.headers.get("location")).toBeNull();
  });

  // Regression: same failure mode as requireAdmin — an unset ADMIN_USER_ID
  // must deny everyone, not accidentally let a falsy-vs-falsy match through.
  it("redirects to /dashboard when ADMIN_USER_ID is unset, even for a signed-in user", async () => {
    delete process.env.ADMIN_USER_ID;
    const res = (await middlewareHandler(makeAuth("someone"), makeReq("/admin/insights"))) as NextResponse;
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("does not touch non-admin routes for a non-admin user", async () => {
    process.env.ADMIN_USER_ID = "admin-123";
    const res = (await middlewareHandler(makeAuth("someone-else"), makeReq("/dashboard"))) as NextResponse;
    expect(res.headers.get("location")).toBeNull();
  });
});
