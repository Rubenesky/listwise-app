import { log } from "@/lib/logger";

export async function sendTriggerEvent(
  userId: string,
  batchId: string,
  mode: string,
  provider = "groq",
  userEmail?: string
) {
  const response = await fetch("https://api.trigger.dev/api/v1/tasks/process-batch/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}`,
    },
    body: JSON.stringify({
      payload: { userId, batchId, mode, provider, userEmail },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ status: response.status, body: errorText }, "Trigger event failed");
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    throw new Error("TRIGGER_FAILED");
  }

  return response.json();
}
