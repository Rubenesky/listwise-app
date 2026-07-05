import { test, expect } from "@playwright/test";

// ─── API health ───────────────────────────────────────────────────────────────

test("GET /api/health returns 200 with status ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.service).toBe("listwise-app");
  expect(typeof body.timestamp).toBe("string");
});

// ─── Landing page ─────────────────────────────────────────────────────────────

test("landing page loads and shows brand name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ListWise/i);
  await expect(page.locator("body")).toContainText(/ListWise/i);
});

test("landing page has a link to /pricing", async ({ page }) => {
  await page.goto("/");
  const pricingLinks = page.locator('a[href="/pricing"], a[href*="pricing"]');
  await expect(pricingLinks.first()).toBeVisible();
});

test("landing page has a link to sign-in or sign-up", async ({ page }) => {
  await page.goto("/");
  const authLink = page.locator(
    'a[href*="sign-in"], a[href*="sign-up"], a[href*="dashboard"]'
  );
  await expect(authLink.first()).toBeVisible();
});

// ─── Pricing page ─────────────────────────────────────────────────────────────

test("pricing page loads and shows plan names", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("body")).toContainText(/Gratuito|Pro|Enterprise/i);
});

test("pricing page shows at least one price in euros", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("body")).toContainText(/€/);
});

// ─── Auth redirect ────────────────────────────────────────────────────────────

test("unauthenticated user visiting /dashboard is redirected to sign-in", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in|accounts\.clerk\.com/);
});

test("unauthenticated user visiting /dashboard/competitor is redirected", async ({
  page,
}) => {
  await page.goto("/dashboard/competitor");
  await expect(page).toHaveURL(/sign-in|accounts\.clerk\.com/);
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

test("unknown route does not crash the server (not a 500)", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist-xyz");
  expect(res?.status()).not.toBe(500);
});
