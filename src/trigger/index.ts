import { TriggerClient } from "@trigger.dev/sdk";

export const triggerClient = new TriggerClient({
  id: "listwise-app",
  apiKey: process.env.TRIGGER_SECRET_KEY,
});