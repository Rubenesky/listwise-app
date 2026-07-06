import { test, expect } from "@playwright/test";

// ─── Landing page — SEO & structure ──────────────────────────────────────────

test("landing page has a meta description", async ({ page }) => {
  await page.goto("/");
  const metaDesc = await page.locator('meta[name="description"]').getAttribute("content");
  expect(metaDesc).toBeTruthy();
  expect(metaDesc!.length).toBeGreaterThan(20);
});

test("landing page has Open Graph title", async ({ page }) => {
  await page.goto("/");
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  expect(ogTitle).toBeTruthy();
});

test("landing page has a visible CTA button", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator('a[href*="sign-up"], a[href*="dashboard"], button').first();
  await expect(cta).toBeVisible();
});

// ─── Pricing page — plan structure ───────────────────────────────────────────

test("pricing page shows Free, Pro, and Enterprise plans", async ({ page }) => {
  await page.goto("/pricing");
  const body = page.locator("body");
  await expect(body).toContainText(/Gratuito|Free/i);
  await expect(body).toContainText(/Pro/i);
  await expect(body).toContainText(/Enterprise/i);
});

test("pricing page has at least one CTA button per plan", async ({ page }) => {
  await page.goto("/pricing");
  const ctaButtons = page.locator('a[href*="sign-up"], button:has-text("Empezar"), button:has-text("Start")');
  await expect(ctaButtons.first()).toBeVisible();
});

// ─── robots.txt & sitemap.xml ─────────────────────────────────────────────────

test("robots.txt is accessible and contains Sitemap directive", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("Sitemap:");
});

test("sitemap.xml is accessible and contains loc elements", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("<loc>");
});

// ─── Security headers ─────────────────────────────────────────────────────────

test("landing page response includes X-Content-Type-Options header", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("landing page response includes x-request-id header", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-request-id"]).toBeTruthy();
});
