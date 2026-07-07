import { groq } from "./client-groq";
import { gemini } from "./client-gemini";
import { log } from "@/lib/logger";

export type AIProvider = "groq" | "gemini";

interface AIProviderConfig {
  name: AIProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  defaultModel: string;
  isAvailable: () => boolean;
}

export const providers: Record<AIProvider, AIProviderConfig> = {
  groq: {
    name: "groq",
    client: groq,
    defaultModel: "llama-3.1-8b-instant",
    isAvailable: () => !!process.env.GROQ_API_KEY,
  },
  gemini: {
    name: "gemini",
    client: gemini,
    defaultModel: "gemini-2.5-flash",
    isAvailable: () => !!process.env.GEMINI_API_KEY,
  },
};

export function getAvailableProviders(): AIProvider[] {
  const available = (Object.keys(providers) as AIProvider[]).filter(
    (key) => providers[key].isAvailable()
  );
  if (available.length === 0) throw new Error("No hay proveedores de IA disponibles");
  return available;
}

export function getDefaultProvider(): AIProvider {
  const available = getAvailableProviders();
  if (available.includes("gemini")) return "gemini";
  return available[0];
}

export async function getAIResponse(
  messages: { role: string; content: string }[],
  providerName?: AIProvider,
  options?: { temperature?: number; max_tokens?: number; response_format?: { type: string } }
): Promise<ReturnType<typeof groq.chat.completions.create>> {
  const selected = providerName ?? getDefaultProvider();
  const config = providers[selected];

  try {
    log.debug({ provider: selected, model: config.defaultModel }, "AI provider selected");
    return await config.client.chat.completions.create({
      model: config.defaultModel,
      messages,
      ...options,
    });
  } catch (error) {
    log.error({ err: error, provider: selected }, "AI provider failed");
    const fallback = getAvailableProviders().find((p) => p !== selected);
    if (!fallback) throw error;
    log.info({ fallback }, "AI fallback provider selected");
    const fb = providers[fallback];
    try {
      return await fb.client.chat.completions.create({
        model: fb.defaultModel,
        messages,
        ...options,
      });
    } catch (fallbackError) {
      log.error({ err: fallbackError, provider: fallback }, "AI fallback provider failed");
      throw fallbackError;
    }
  }
}
