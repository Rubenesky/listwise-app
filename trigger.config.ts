import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_grlooejdebpxiuemlxvn",
  runtime: "node",
  logLevel: "log",
  maxDuration: 60,
  dirs: ["./src/trigger"],
  build: {
    external: ["@libsql/linux-x64-gnu"],
  },
});
