import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY no está configurada en el archivo .env.local");
}

export const groq = new Groq({
  apiKey: apiKey,
});