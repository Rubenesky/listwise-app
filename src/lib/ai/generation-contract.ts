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

function sharesVerbatimChunk(source: string, target: string, minWords: number): boolean {
  const targetNorm = normalizeForOverlap(target);
  if (!targetNorm) return false;
  const sourceWords = normalizeForOverlap(source).split(" ").filter(Boolean);
  for (let i = 0; i + minWords <= sourceWords.length; i++) {
    const chunk = sourceWords.slice(i, i + minWords).join(" ");
    if (targetNorm.includes(chunk)) return true;
  }
  return false;
}

// Defense-in-depth for the paragraph-2 PROHIBIDO rule in buildSystemPrompt:
// the prompt-only fix (widened rule + AUTOVERIFICACION example) didn't hold
// on retest — real generations still restated bullet content verbatim in the
// description. This won't catch every paraphrase, but it catches exactly the
// failure actually observed: a long word-for-word chunk shared between a
// bullet's detail and the description.
export function hasVerbatimBulletOverlap(bullets: string[], description: string): boolean {
  return bullets.some((bullet) => {
    const colonIdx = bullet.indexOf(":");
    const detail = colonIdx >= 0 ? bullet.slice(colonIdx + 1) : bullet;
    return sharesVerbatimChunk(detail, description, MIN_OVERLAP_WORDS);
  });
}

// Regression: once the 120-word retry started working, a second attempt
// sometimes hit the minimum by padding — repeating an earlier paragraph
// almost verbatim later in the same description — rather than writing new
// content. hasVerbatimBulletOverlap doesn't catch this: it only compares
// bullets against the description, not the description against itself.
export function hasVerbatimParagraphOverlap(description: string): boolean {
  const paragraphs = description.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < paragraphs.length; i++) {
    for (let j = i + 1; j < paragraphs.length; j++) {
      if (sharesVerbatimChunk(paragraphs[i], paragraphs[j], MIN_OVERLAP_WORDS)) return true;
    }
  }
  return false;
}

// Named, specific reasons a generation misses the contract — used both to
// decide whether to retry and to tell the model exactly what to fix on the
// next attempt (see generateWithContentRetry). Blindly resampling the same
// prompt on a miss doesn't reliably fix it (real case: a second attempt hit
// 120 words by self-repeating a paragraph); concrete feedback about what was
// wrong is the standard fix for LLM retry loops.
export function describeContentContractFailure(generated: { bullets: string[]; description: string }): string[] {
  const issues: string[] = [];
  const wordCount = generated.description.trim().split(/\s+/).filter(Boolean).length;
  if (generated.bullets.length < MIN_BULLETS) {
    issues.push(`solo ${generated.bullets.length} bullets (mínimo ${MIN_BULLETS})`);
  }
  if (wordCount < MIN_DESCRIPTION_WORDS) {
    issues.push(`la descripción tiene ${wordCount} palabras (mínimo ${MIN_DESCRIPTION_WORDS})`);
  }
  if (hasVerbatimBulletOverlap(generated.bullets, generated.description)) {
    issues.push("la descripción repite el texto de un bullet casi literalmente");
  }
  if (hasVerbatimParagraphOverlap(generated.description)) {
    issues.push("dos párrafos de la descripción repiten la misma información entre sí");
  }
  return issues;
}

export function meetsContentContract(generated: { bullets: string[]; description: string }): boolean {
  return describeContentContractFailure(generated).length === 0;
}

// Pure, callback-driven retry loop so the orchestration (how many attempts,
// when to stop, what's returned on exhaustion) is unit-testable without
// pulling in @trigger.dev/sdk, the DB, or the AI provider — none of which
// this codebase's test suite mocks anywhere else. Always returns the last
// result even if it never meets the contract: a listing with imperfect
// content is better than one that fails outright after using a credit.
export async function generateWithContentRetry<T extends { bullets: string[]; description: string }>(
  generate: (feedback?: string) => Promise<T>,
  maxAttempts: number,
  onRetry?: (attempt: number, result: T, issues: string[]) => void
): Promise<T> {
  let result = await generate();
  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    const issues = describeContentContractFailure(result);
    if (issues.length === 0) break;
    onRetry?.(attempt, result, issues);
    const feedback = `Tu intento anterior no cumplió estos requisitos: ${issues.join("; ")}. Genera una versión nueva y genuina para estos mismos campos — no repitas frases de tu intento anterior, ni entre bullets y descripción, ni entre distintos párrafos de la descripción.`;
    result = await generate(feedback);
  }
  return result;
}
