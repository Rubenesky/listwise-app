import type Groq from "groq-sdk";
import { groq } from "./client-groq";
import { gemini } from "./client-gemini";

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
    console.log(`🤖 [AI] Usando proveedor: ${selected} (${config.defaultModel})`);
    return await config.client.chat.completions.create({
      model: config.defaultModel,
      messages,
      ...options,
    });
  } catch (error) {
    console.error(`❌ [AI] Falló ${selected}:`, error);
    const fallback = getAvailableProviders().find((p) => p !== selected);
    if (!fallback) throw error;
    console.log(`🔄 [AI] Usando fallback: ${fallback}`);
    const fb = providers[fallback];
    try {
      return await fb.client.chat.completions.create({
        model: fb.defaultModel,
        messages,
        ...options,
      });
    } catch (fallbackError) {
      console.error(`❌ [AI] Falló fallback ${fallback}:`, fallbackError);
      throw fallbackError;
    }
  }
}
