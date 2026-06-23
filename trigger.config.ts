import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "listwise-ngV8", // <-- Project ID real
  runtime: "node",
  logLevel: "log",
  maxDuration: 60,
  dirs: ["./src/trigger"],
});