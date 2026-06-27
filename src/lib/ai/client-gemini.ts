type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

type GeminiRequest = {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    thinkingConfig?: { thinkingBudget: number };
  };
};

type GeminiResponse = {
  candidates: Array<{
    content: { parts: { text: string }[] };
  }>;
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = "gemini-2.5-flash";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`[Gemini] GEMINI_API_KEY: ${apiKey ? "✅ presente" : "❌ ausente"}`);
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");
  return apiKey;
}

function buildRequest(params: {
  messages: { role: string; content: string }[];
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}): GeminiRequest {
  const systemMsg = params.messages.find((m) => m.role === "system")?.content;
  const nonSystem = params.messages.filter((m) => m.role !== "system");

  const contents: GeminiContent[] = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const req: GeminiRequest = {
    contents,
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
      responseMimeType: params.jsonMode ? "application/json" : "text/plain",
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (systemMsg) {
    req.systemInstruction = { parts: [{ text: systemMsg }] };
  }

  return req;
}

async function geminiPost(model: string, apiKey: string, body: GeminiRequest): Promise<string> {
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text}`);
  }

  const data = (await res.json()) as GeminiResponse;
  // Thinking models (gemini-2.5-flash) return thought parts + text parts; only keep text parts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = (data.candidates?.[0]?.content?.parts ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = parts.filter((p: any) => !p.thought && typeof p.text === "string").map((p: any) => p.text as string).join("").trim();
  console.log(`[Gemini] Respuesta (primeros 200 chars): ${text.slice(0, 200)}`);
  if (!text) throw new Error("Gemini devolvió respuesta vacía");
  return text;
}

// OpenAI-compatible facade used by providers.ts, agent/chat, analyze-competitor
export const gemini = {
  chat: {
    completions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async (params: any): Promise<any> => {
        const apiKey = getApiKey();
        console.log("[Gemini] ✅ Cliente inicializado (REST v1)");
        const model: string = params.model ?? GEMINI_MODEL;
        const isJson = params.response_format?.type === "json_object";

        const body = buildRequest({
          messages: params.messages,
          temperature: params.temperature,
          maxOutputTokens: params.max_tokens,
          jsonMode: isJson,
        });

        const text = await geminiPost(model, apiKey, body);

        if (params.stream) {
          // Agent needs async iterable — return full text as single chunk
          return (async function* () {
            yield {
              id: `gemini-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: "stop" }],
            };
          })();
        }

        return {
          id: `gemini-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop", logprobs: null }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    },
  },
};
