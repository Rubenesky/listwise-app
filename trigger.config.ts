import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_grlooejdebpxiuemlxvn", // <-- Project ID real
  runtime: "node",
  logLevel: "log",
  maxDuration: 60,
  dirs: ["./src/trigger"],
});