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
