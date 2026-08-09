// Checks a freshly-generated listing against the hard contract stated in
// buildSystemPrompt's own rules ("SIEMPRE entre 4 y 6, nunca menos de 4" bullets;
// "AL MENOS 120 palabras" description) — both explicitly phrased as mandatory,
// unlike the closing-phrase style guidance which is a soft recommendation. The
// Zod schema in process-products.ts stays permissive (min 1 bullet) so a
// contract miss triggers a same-prompt retry instead of an immediate hard
// failure — see meetsContentContract's caller for the retry loop.
// Safety-net truncation for when the model exceeds the prompt's own title
// length rule — cuts at the last word boundary instead of mid-word, so the
// fallback never produces a visibly broken title.
export function truncateAtWordBoundary(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const truncated = s.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

const MIN_BULLETS = 4;
const MIN_DESCRIPTION_WORDS = 120;

function normalizeForOverlap(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_OVERLAP_WORDS = 6;

// Defense-in-depth for the paragraph-2 PROHIBIDO rule in buildSystemPrompt:
// the prompt-only fix (widened rule + AUTOVERIFICACION example) didn't hold
// on retest — real generations still restated bullet content verbatim in the
// description. This won't catch every paraphrase, but it catches exactly the
// failure actually observed: a long word-for-word chunk shared between a
// bullet's detail and the description.
export function hasVerbatimBulletOverlap(bullets: string[], description: string): boolean {
  const descNorm = normalizeForOverlap(description);
  if (!descNorm) return false;
  for (const bullet of bullets) {
    const colonIdx = bullet.indexOf(":");
    const detail = colonIdx >= 0 ? bullet.slice(colonIdx + 1) : bullet;
    const words = normalizeForOverlap(detail).split(" ").filter(Boolean);
    for (let i = 0; i + MIN_OVERLAP_WORDS <= words.length; i++) {
      const chunk = words.slice(i, i + MIN_OVERLAP_WORDS).join(" ");
      if (descNorm.includes(chunk)) return true;
    }
  }
  return false;
}

export function meetsContentContract(generated: { bullets: string[]; description: string }): boolean {
  const wordCount = generated.description.trim().split(/\s+/).filter(Boolean).length;
  return (
    generated.bullets.length >= MIN_BULLETS &&
    wordCount >= MIN_DESCRIPTION_WORDS &&
    !hasVerbatimBulletOverlap(generated.bullets, generated.description)
  );
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
