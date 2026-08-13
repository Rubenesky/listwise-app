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

// Detailed style instruction (not a separate API parameter — Gemini's native
// TTS reads style cues from the input text itself). A vague one-liner like
// "read this enthusiastically" underperformed a specific, concrete
// instruction in a real listening review of generated audio.
const STYLE_INSTRUCTION = `Lee este texto como un vendedor profesional hablando directamente con un cliente por WhatsApp.

Habla en español natural de España, con un tono cercano, seguro, agradable y profesional.

No lo leas como una ficha de producto ni como un anuncio publicitario de televisión.

Debe parecer una recomendación personal de un vendedor que conoce bien el producto.

Utiliza una entonación conversacional y natural. Da ligeramente más énfasis a los beneficios que a las características técnicas.

Haz pausas naturales cuando cambie la idea, pero evita hacer una pausa después de cada frase.

Mantén un ritmo ágil y cómodo, adecuado para una nota de voz de WhatsApp.

No exageres la emoción ni suenes demasiado entusiasta. La sensación debe ser de confianza y profesionalidad.

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

// Gemini's native TTS returns raw PCM (typically 16-bit signed little-endian,
// mono) wrapped in an inlineData part, not a ready-to-play container format.
// Media players need a WAV header to know how to interpret those bytes.
function wrapPcmAsWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
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

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    log.error({ status: res.status, err: errText }, "Gemini TTS request failed");
    throw new Error(`Gemini TTS ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as GeminiAudioResponse;
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
  return { buffer: wrapPcmAsWav(rawBuffer, sampleRate), mimeType: "audio/wav" };
}
