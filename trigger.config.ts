import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_grlooejdebpxiuemlxvn", // <-- REEMPLAZA CON TU PROJECT ID REAL
  runtime: "node",
  logLevel: "log",
  maxDuration: 60,
  dirs: ["./src/trigger"],
});