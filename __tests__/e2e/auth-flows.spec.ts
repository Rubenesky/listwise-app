import { test, expect } from "@playwright/test";

// ─── Auth redirect (unauthenticated) ─────────────────────────────────────────
// These tests do not require real credentials.

test("sign-in page loads without a server error", async ({ page }) => {
  const res = await page.goto("/sign-in");
  expect(res?.status()).not.toBe(500);
  expect(res?.status()).not.toBe(404);
});

test("sign-up page loads without a server error", async ({ page }) => {
  const res = await page.goto("/sign-up");
  expect(res?.status()).not.toBe(500);
  expect(res?.status()).not.toBe(404);
});

test("sign-in page has email input or Clerk widget", async ({ page }) => {
  await page.goto("/sign-in");
  // Clerk renders either an iframe or a direct form — wait for either
  const hasClerkWidget =
    (await page.locator('iframe[src*="clerk"]').count()) > 0 ||
    (await page.locator('input[type="email"], input[name="identifier"]').count()) > 0;
  expect(hasClerkWidget).toBe(true);
});

// ─── Authenticated flow stubs (skipped — require real Clerk session) ──────────
// To run locally: export TEST_USER_EMAIL and TEST_USER_PASSWORD env vars,
// then uncomment `test.skip(false)` below.

test.skip("authenticated user can reach the dashboard", async ({ page }) => {
  // Stub: sign in via Clerk API, navigate to /dashboard, verify content
  await page.goto("/dashboard");
  await expect(page.locator("body")).toContainText(/dashboard|listing/i);
});

test.skip("authenticated user can navigate to competitor analysis", async ({ page }) => {
  await page.goto("/dashboard/competitor");
  await expect(page.locator("body")).not.toContainText(/sign-in/i);
});

test.skip("authenticated user can upload a CSV file", async ({ page }) => {
  await page.goto("/dashboard");
  const uploadButton = page.locator('input[type="file"], button:has-text("Upload"), button:has-text("CSV")').first();
  await expect(uploadButton).toBeVisible();
});
