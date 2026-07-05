export const PRICE_TO_PLAN: Record<string, string> = {
  "price_1Tl68X1uySlskct3CuBf7pjw": "pro",
  "price_1Tl69t1uySlskct3TIl1qBqc": "enterprise",
  "price_1TncET1uySlskct3tPbtAzJA": "pro",
  "price_1TncFM1uySlskct3Lin2vkKE": "enterprise",
};

export function planFromPriceId(priceId: string): string | null {
  return PRICE_TO_PLAN[priceId] ?? null;
}

export function parseAgentCredits(metadata: Record<string, string | undefined>): number {
  if (metadata.type !== "agent_credits") return 0;
  const n = parseInt(metadata.credits ?? "0", 10);
  return isNaN(n) || n < 0 ? 0 : n;
}
