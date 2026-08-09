import { readFileSync } from "fs";
import { join } from "path";

// Regression: Clerk needs to create a Web Worker from a blob: URL for its
// dev-browser/session-sync machinery. Without worker-src in the CSP,
// browsers fall back to script-src (which doesn't allow blob:), silently
// blocking Clerk's session refresh and causing sporadic, hard-to-diagnose
// auth failures. Read as plain text rather than importing the .mjs config
// module, to avoid ESM/ts-jest interop entirely for a simple string check.
describe("next.config.mjs CSP", () => {
  const configSource = readFileSync(join(process.cwd(), "next.config.mjs"), "utf-8");

  it("includes worker-src with blob: so Clerk's session-sync worker isn't blocked", () => {
    expect(configSource).toMatch(/worker-src[^"]*blob:/);
  });
});
