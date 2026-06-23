import DeepSeek from "deepseek-sdk";

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error("DEEPSEEK_API_KEY no está configurada en el archivo .env.local");
}

export const deepseek = new DeepSeek({
  apiKey: apiKey,
});