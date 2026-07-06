import Groq from "groq-sdk";
import { log } from "@/lib/logger";

let _instance: Groq | undefined;

function getInstance(): Groq {
  if (_instance) return _instance;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada");
  }

  _instance = new Groq({ apiKey });
  log.debug("Groq client initialized");
  return _instance;
}

export const groq = new Proxy({} as Groq, {
  get(_target, prop: string | symbol) {
    const instance = getInstance();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
