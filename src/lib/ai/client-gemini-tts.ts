import { log } from "@/lib/logger";

// Sibling to client-gemini.ts's geminiPost() — same raw-REST pattern (this app
// doesn't use the @google/generative-ai SDK at all, it talks to the Gemini
// REST endpoint directly), but targets the audio-output model instead of the
// text chat-completion one. The exact request/response shape here is based on
// Gemini's documented native-audio contract, not empirically confirmed yet —
// the first real call against staging is the actual verification.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Kore";
const MAX_INPUT_CHARS = 5000;
// A real listening review measured the raw output peaking at -0.0003 dBFS
// (essentially touching the digital ceiling) — safe headroom for whatever
// plays it back next (WhatsApp, phone speakers, etc.), no audible quality
// tradeoff at this size.
const OUTPUT_GAIN_DB = -1.5;

// Detailed style instruction (not a separate API parameter — Gemini's native
// TTS reads style cues from the input text itself). A vague one-liner like
// "read this enthusiastically" underperformed a specific, concrete
// instruction in a real listening review of generated audio.
const STYLE_INSTRUCTION = `Lee este texto como un vendedor profesional hablando directamente con un cliente por WhatsApp.

Habla en español natural de España, con un tono cercano, seguro, agradable y profesional.

No lo leas como una ficha de producto ni como un anuncio publicitario de televisión.

Debe parecer una recomendación personal de un vendedor que conoce bien el producto.

Interpreta el texto como una conversación natural con un comprador. No leas cada frase como una unidad independiente, ni marques artificialmente cada característica.

Utiliza una entonación conversacional y natural. Da ligeramente más énfasis a los beneficios que a las características técnicas. Varía ligeramente la entonación y el ritmo para que parezca que estás explicando el producto de forma espontánea. Evita una entonación descendente repetitiva al final de cada frase.

Las pausas deben producirse principalmente cuando cambia la idea que estás explicando, no simplemente porque aparece un punto en el texto — evita hacer una pausa después de cada frase.

Mantén un ritmo ágil y cómodo, adecuado para una nota de voz de WhatsApp.

No exageres la emoción ni suenes demasiado entusiasta. Prioriza naturalidad y confianza sobre dramatización.

La locución debe sentirse espontánea y conversacional, como si estuvieras recomendando personalmente el producto a un comprador interesado. No intentes sonar más persuasivo aumentando la energía. La persuasión debe venir de la naturalidad, la seguridad y el énfasis sutil en los beneficios.

Texto:
`;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada");
  return apiKey;
}

interface GeminiAudioResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
}

// Scales 16-bit PCM samples by a dB gain (negative = quieter), clamping to
// avoid wraparound. Applied once, before wrapping in a WAV header.
export function applyGain(pcm: Buffer, gainDb: number): Buffer {
  const factor = Math.pow(10, gainDb / 20);
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i);
    const scaled = Math.max(-32768, Math.min(32767, Math.round(sample * factor)));
    out.writeInt16LE(scaled, i);
  }
  return out;
}

// Gemini's native TTS returns raw PCM (typically 16-bit signed little-endian,
// mono) wrapped in an inlineData part, not a ready-to-play container format.
// Media players need a WAV header to know how to interpret those bytes.
export function wrapPcmAsWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

// gemini-2.5-flash-preview-tts is a preview model — real usage showed
// occasional transient 500/429s that succeed on a plain retry a moment
// later. A single retry recovers most of those without meaningfully
// slowing down the common case (a transient error itself returns fast;
// only a genuine hang eats the timeout budget below). Not retried: 4xx
// errors other than 408/429 (a malformed request or safety block fails
// the exact same way again — retrying just adds latency for nothing).
const MAX_TTS_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 500;
// The first attempt keeps the original 30s ceiling (unchanged, proven
// timeout for the common success path). The retry gets a shorter 10s
// budget — if Gemini is having a bad moment, a quick second try either
// recovers fast or fails fast, instead of doubling the worst-case wait.
const FIRST_ATTEMPT_TIMEOUT_MS = 30000;
const RETRY_ATTEMPT_TIMEOUT_MS = 10000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTtsWithRetry(url: string, apiKey: string, body: unknown): Promise<GeminiAudioResponse> {
  let lastError: Error = new Error("Gemini TTS: fallo desconocido");

  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt++) {
    const isRetry = attempt > 1;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        // Without a bound, a hung Gemini request blocks indefinitely — if the
        // platform then kills the request before this resolves, the route's
        // refund-on-failure catch never runs and the user keeps a charge with
        // no audio. Bounding it here guarantees the catch always fires.
        signal: AbortSignal.timeout(isRetry ? RETRY_ATTEMPT_TIMEOUT_MS : FIRST_ATTEMPT_TIMEOUT_MS),
      });

      if (res.ok) return (await res.json()) as GeminiAudioResponse;

      // Truncated: Gemini's safety-filter error bodies can echo back part of
      // the submitted text, which would otherwise land in logs verbatim.
      const errText = (await res.text()).slice(0, 200);
      lastError = new Error(`Gemini TTS ${res.status}: ${errText}`);
      if (!RETRYABLE_STATUS.has(res.status)) {
        log.error({ status: res.status, err: errText }, "Gemini TTS request failed (not retried)");
        throw lastError;
      }
      log.warn({ status: res.status, attempt, err: errText }, "Gemini TTS request failed, will retry");
    } catch (err) {
      if (err === lastError) throw err; // non-retryable status thrown above — propagate immediately
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn({ err: lastError, attempt }, "Gemini TTS request errored, will retry");
    }

    if (attempt < MAX_TTS_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  log.error({ err: lastError }, "Gemini TTS failed after all retries");
  throw lastError;
}

export async function generateSpeech(text: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = getApiKey();
  const trimmed = (STYLE_INSTRUCTION + text).slice(0, MAX_INPUT_CHARS);

  const url = `${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: trimmed }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: DEFAULT_VOICE } },
      },
    },
  };

  const data = await fetchTtsWithRetry(url, apiKey, body);
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini TTS no devolvió datos de audio");
  }

  const rawBuffer = Buffer.from(inlineData.data, "base64");
  const mimeType = inlineData.mimeType ?? "audio/L16;rate=24000";

  // Raw PCM comes back as something like "audio/L16;codec=pcm;rate=24000" —
  // anything else (already-encoded audio) is passed through unchanged.
  const isPcm = /L16|pcm/i.test(mimeType);
  if (!isPcm) {
    return { buffer: rawBuffer, mimeType };
  }

  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const gained = applyGain(rawBuffer, OUTPUT_GAIN_DB);
  return { buffer: wrapPcmAsWav(gained, sampleRate), mimeType: "audio/wav" };
}
