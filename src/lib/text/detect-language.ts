// Simple marker-word heuristic, not a real language-detection model — cheap
// and good enough for the common case, but known to misfire on short or
// mixed-language text (e.g. Spanish spec sheets with English brand/technical
// terms). Documented limitation, not a blocker for v1 — see design spec.
const SPANISH_MARKERS = /\b(el|la|los|las|de|del|para|con|una|uno|es|son|está|están|que|más|sin|fabricado|producto)\b/gi;
const ENGLISH_MARKERS = /\b(the|and|for|with|is|are|this|that|from|without|more|manufactured|product)\b/gi;
const MIN_SIGNAL = 5;

export function detectLanguageMismatch(text: string, expected: "es" | "en"): boolean {
  const sample = text.slice(0, 2000);
  const esMatches = (sample.match(SPANISH_MARKERS) ?? []).length;
  const enMatches = (sample.match(ENGLISH_MARKERS) ?? []).length;
  const total = esMatches + enMatches;
  if (total < MIN_SIGNAL) return false;
  const dominant = esMatches >= enMatches ? "es" : "en";
  return dominant !== expected;
}
