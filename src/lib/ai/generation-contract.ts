// Checks a freshly-generated listing against the hard contract stated in
// buildSystemPrompt's own rules ("SIEMPRE entre 4 y 6, nunca menos de 4" bullets;
// "AL MENOS 120 palabras" description) — both explicitly phrased as mandatory,
// unlike the closing-phrase style guidance which is a soft recommendation. The
// Zod schema in process-products.ts stays permissive (min 1 bullet) so a
// contract miss triggers a same-prompt retry instead of an immediate hard
// failure — see meetsContentContract's caller for the retry loop.
const MIN_BULLETS = 4;
const MIN_DESCRIPTION_WORDS = 120;

export function meetsContentContract(generated: { bullets: string[]; description: string }): boolean {
  const wordCount = generated.description.trim().split(/\s+/).filter(Boolean).length;
  return generated.bullets.length >= MIN_BULLETS && wordCount >= MIN_DESCRIPTION_WORDS;
}

// Pure, callback-driven retry loop so the orchestration (how many attempts,
// when to stop, what's returned on exhaustion) is unit-testable without
// pulling in @trigger.dev/sdk, the DB, or the AI provider — none of which
// this codebase's test suite mocks anywhere else. Always returns the last
// result even if it never meets the contract: a listing with imperfect
// content is better than one that fails outright after using a credit.
export async function generateWithContentRetry<T extends { bullets: string[]; description: string }>(
  generate: () => Promise<T>,
  maxAttempts: number,
  onRetry?: (attempt: number, result: T) => void
): Promise<T> {
  let result = await generate();
  for (let attempt = 1; attempt < maxAttempts && !meetsContentContract(result); attempt++) {
    onRetry?.(attempt, result);
    result = await generate();
  }
  return result;
}
