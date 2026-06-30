import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@trigger.dev/sdk", "@trigger.dev/sdk/v3"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
