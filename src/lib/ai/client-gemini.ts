import OpenAI from "openai";

let _instance: OpenAI | undefined;

function getInstance(): OpenAI {
  if (_instance) return _instance;

  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`[Gemini] GEMINI_API_KEY: ${apiKey ? "✅ presente" : "❌ ausente"}`);

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada");
  }

  _instance = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  console.log("[Gemini] ✅ Cliente inicializado");
  return _instance;
}

export const gemini = new Proxy({} as OpenAI, {
  get(_target, prop: string | symbol) {
    const instance = getInstance();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
