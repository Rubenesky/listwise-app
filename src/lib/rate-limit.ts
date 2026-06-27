import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
