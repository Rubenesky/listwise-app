import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

// Agent chat: 3 requests per minute (per user)
export const ratelimitAgentMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"),
  analytics: false,
  prefix: "@upstash/ratelimit/agent-minute",
});

// Agent chat: 10 requests per hour (free users only)
export const ratelimitAgentHour = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/agent-hour",
});

// Gamification: flood protection (50 calls per hour per user)
export const ratelimitGamification = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "1 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/gamification",
});

// Competitor analysis: 5 analyses per user per day
export const ratelimitCompetitor = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/competitor",
});

// Listing save: 30 saves per minute per user (anti-spam)
export const ratelimitSave = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: false,
  prefix: "@upstash/ratelimit/save",
});

// Lead magnet: 3 submissions per IP per day
export const ratelimitLeads = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(3, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/leads",
});

// Input Enriquecido (URL en CSV o PDF por listing, o analizar URL/PDF para
// crear producto): 50 solicitudes/día por usuario. Solo protege contra abuso
// del paso de análisis gratuito — el paso de creación ya está protegido por
// el cobro de créditos.
export const ratelimitEnrichedInput = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(50, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/enriched-input",
});

// Voice profile creation: 10 análisis por usuario por día. La acción ya cuesta
// 1 crédito, pero esto acota ráfagas independientemente del saldo de créditos.
export const ratelimitVoiceProfile = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/voice-profile",
});

// Audio generation (TTS) de un listing: 15 generaciones por usuario por día.
// Cuesta 2 créditos, esto acota ráfagas independientemente del saldo.
export const ratelimitAudioGeneration = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(15, "24 h"),
  analytics: false,
  prefix: "@upstash/ratelimit/audio-generation",
});
