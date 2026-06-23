import Groq from "groq-sdk";

let _instance: Groq | undefined;

function getInstance(): Groq {
  if (_instance) return _instance;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada");
  }

  _instance = new Groq({ apiKey });
  return _instance;
}

// Proxy: misma API que antes, cliente creado solo en el primer uso real
export const groq = new Proxy({} as Groq, {
  get(_target, prop: string | symbol) {
    return getInstance()[prop as keyof Groq];
  },
});
