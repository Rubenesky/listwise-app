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
// sometimes hit the minimum by padding — repeating earlier content almost
// verbatim later in the same description — rather than writing new content.
// hasVerbatimBulletOverlap doesn't catch this: it only compares bullets
// against the description, not the description against itself. Splitting by
// sentence (not just \n\n paragraph breaks) catches a further real case: a
// repeated refrain within a SINGLE paragraph with no \n\n at all — a
// repeated paragraph is also repeated sentences, so this is a strict
// generalization of a paragraph-only check, not a parallel one.
export function hasVerbatimSentenceOverlap(description: string): boolean {
  const sentences = description
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (sharesVerbatimChunk(sentences[i], sentences[j], MIN_OVERLAP_WORDS)) return true;
    }
  }
  return false;
}

// Regression: two bullets can describe the SAME fact with different wording
// (no literal 6-word overlap, so hasVerbatimBulletOverlap misses it) — e.g.
// "conecta sin cables a 15 m" and "conexión de 15 m sin cables en cualquier
// lugar" both about the same 15m range. Two different bullets citing the
// exact same number+unit is a cheap, strong signal they cover the same
// point instead of distinct ones, without needing to judge meaning.
const DATA_TOKEN = /\d+(?:[.,]\d+)?\s*(?:%|kg|mg|g\b|ml|l\b|cm|mm|km|m\b|h\b|horas?\b|min(?:utos?)?\b|seg(?:undos?)?\b|s\b|€|\$|w\b|mah|db|k\b)/gi;

export function hasDuplicateBulletDataPoint(bullets: string[]): boolean {
  const seen = new Set<string>();
  for (const bullet of bullets) {
    const matches = bullet.match(DATA_TOKEN) ?? [];
    for (const match of matches) {
      const normalized = match.toLowerCase().replace(/\s+/g, "");
      if (seen.has(normalized)) return true;
      seen.add(normalized);
    }
  }
  return false;
}

// Named, specific reasons a generation misses the contract — used to rank
// candidates in generateBestOfN (fewest issues wins when none pass outright)
// and for observability logging.
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
  if (hasVerbatimSentenceOverlap(generated.description)) {
    issues.push("dos frases de la descripción repiten la misma información entre sí");
  }
  if (hasDuplicateBulletDataPoint(generated.bullets)) {
    issues.push("dos bullets distintos repiten el mismo dato numérico (ej: la misma medida o distancia) — cada bullet debe cubrir un punto distinto");
  }
  return issues;
}

export function meetsContentContract(generated: { bullets: string[]; description: string }): boolean {
  return describeContentContractFailure(generated).length === 0;
}

// Pure, callback-driven best-of-N so the selection logic (call generate n
// times, keep whichever meets the contract, fall back to the fewest-issues
// candidate) is unit-testable without pulling in @trigger.dev/sdk, the DB,
// or the AI provider — none of which this codebase's test suite mocks
// anywhere else. Replaced a sequential feedback-driven retry loop: that
// fixed real bugs (self-padding, missing bullets) but multiplied latency up
// to 3x in the worst case. Firing N independent candidates via Promise.all
// costs the same total AI calls but takes ~1x wall-clock time since they
// run concurrently — generation speed is a stated competitive advantage,
// so latency isn't a free variable here. No feedback loop needed: the
// candidates are independent, so the fixes that make individual generations
// more reliable belong in the base prompt (word-count reinforcement, the
// CIERRE anti-generic-closing rule), where they help every candidate
// equally instead of only later sequential ones.
export async function generateBestOfN<T extends { bullets: string[]; description: string }>(
  generate: () => Promise<T>,
  n: number,
  onAttempt?: (index: number, result: T, issues: string[]) => void
): Promise<T> {
  const results = await Promise.all(Array.from({ length: n }, () => generate()));
  let best = results[0];
  let bestIssues = describeContentContractFailure(results[0]);
  onAttempt?.(0, results[0], bestIssues);
  for (let i = 1; i < results.length; i++) {
    const issues = describeContentContractFailure(results[i]);
    onAttempt?.(i, results[i], issues);
    if (issues.length < bestIssues.length) {
      best = results[i];
      bestIssues = issues;
    }
  }
  return best;
}
