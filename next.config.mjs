import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for styles; 'unsafe-eval' for dev HMR
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://clerk.listwise.io",
  "style-src 'self' 'unsafe-inline'",
  // Allow images from any HTTPS origin (product images, CDN assets, Clerk avatars)
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // API calls to Clerk, Stripe, Upstash, Sentry, PostHog, Trigger.dev, Turso
  "connect-src 'self' https:",
  // Clerk OAuth hosted pages need frame-src
  "frame-src 'self' https://clerk.listwise.io https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@trigger.dev/sdk",
    "@trigger.dev/sdk/v3",
    "groq-sdk",
    "@google/generative-ai",
    "openai",
    "cheerio",
    "@libsql/client",
    // Pino uses worker threads for transports — keep external so
    // node_modules paths (lib/worker.js) resolve correctly at runtime
    "pino",
    "pino-pretty",
    "thread-stream",
    "@logtail/pino",
    // Anthropic SDK has module-level instantiation; keep external to avoid
    // missing-key error during Next.js "Collecting page data" build phase
    "@anthropic-ai/sdk",
  ],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default withSentryConfig(analyzedConfig, {
  silent: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
