import Anthropic from "@anthropic-ai/sdk";

// Singleton client reused across the worker process lifetime
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
