/**
 * Validated environment variables — SERVER ONLY.
 * Never import this file in client components or any file that
 * might be bundled for the browser (e.g. files under app/ that
 * do NOT have "use server" / route handlers / server actions).
 *
 * This module validates all required env vars at startup and throws
 * a descriptive error immediately if any required variable is missing,
 * rather than surfacing the problem later at runtime.
 */

import { z } from "zod";

const envSchema = z.object({
  // ── Required server-only ──────────────────────────────────────────────
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  TRIGGER_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // ── Optional server-only ─────────────────────────────────────────────
  /** Sender address for transactional emails (e.g. "Listwise <no-reply@listwise.io>") */
  FROM_EMAIL: z.string().optional(),
  /** Restrict admin API routes to this email address */
  ADMIN_EMAIL: z.string().email().optional(),
  /** Restrict admin API routes to this Clerk user ID */
  ADMIN_USER_ID: z.string().optional(),
  /** Salt used to hash visitor IP addresses for lead deduplication (min 16 chars) */
  IP_HASH_SALT: z.string().min(16).optional(),
  /** Publicly accessible URL of the lead-magnet PDF */
  LEAD_MAGNET_PDF_URL: z.string().url().optional(),
  /** AI providers — all optional; the app degrades gracefully when absent */
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  /** Scraping providers */
  ZENROWS_API_KEY: z.string().optional(),
  SCRAPINGBEE_API_KEY: z.string().optional(),
  /** Which scraping provider to use: "zenrows" | "scrapingbee" | "native" */
  SCRAPING_PROVIDER: z.enum(["zenrows", "scrapingbee", "native"]).optional(),
  /** Stripe credit-pack price IDs (small / medium / large) */
  STRIPE_PACK_S_PRICE_ID: z.string().optional(),
  STRIPE_PACK_M_PRICE_ID: z.string().optional(),
  STRIPE_PACK_L_PRICE_ID: z.string().optional(),
  /** Structured log level */
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // ── Public (available on both server and client via NEXT_PUBLIC_ prefix) ──
  NEXT_PUBLIC_APP_URL: z.string().url(),
  /** Legacy alias — prefer NEXT_PUBLIC_APP_URL in new code */
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment.  Import this instead of
 * accessing `process.env` directly in server-side code.
 *
 * @example
 * import { env } from "@/lib/env";
 * const db = createClient({ url: env.TURSO_DATABASE_URL });
 */
// During CI builds (SKIP_ENV_VALIDATION=1) or Next.js page collection
// (NEXT_PHASE=phase-production-build) server secrets aren't available.
// Runtime deployments (Render) always have real values and validate normally.
export const env =
  process.env.SKIP_ENV_VALIDATION || process.env.NEXT_PHASE === "phase-production-build"
    ? (process.env as unknown as Env)
    : envSchema.parse(process.env);
