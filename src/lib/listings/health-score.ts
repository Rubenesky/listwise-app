// Rule-based content-quality scoring — no AI call, deterministic from the
// listing's own generated fields. Shared by the dashboard's Health column and
// the Agent's /api/agent/analyze so both report the exact same score.

import { hasSections, parseDescriptionSections } from "./render-sections";

export interface ScoreResult {
  score: number;
  notes: string[];
}

// Generic, plantilla-style openers/fillers that carry no real product
// information — a reliable signal the model fell back to a template instead
// of writing something specific to this item (e.g. "Deja atrás las prendas
// que solo cubren" says nothing about THIS product).
const GENERIC_PHRASES = /\b(deja atrás|elige (?:un|una|el|la) [a-záéíóúñ]+ que|no busques más|olv[ií]date de|la mejor opción|calidad premium|alta calidad|máxima comodidad|el mejor [a-záéíóúñ]+ del mercado)\b/i;

function firstSentence(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+/)[0] ?? text;
}

export function analyzeTitle(title: string | null): ScoreResult {
  if (!title?.trim()) return { score: 0, notes: ["sin título generado"] };
  const len = title.length;
  let score = 0;
  const notes: string[] = [];

  if (len >= 60 && len <= 200) { score += 15; notes.push(`${len} chars — longitud ideal`); }
  else if (len < 60) { score += 5; notes.push(`${len} chars (mín 60)`); }
  else { score += 8; notes.push(`${len} chars (máx 200)`); }

  if (/[®©™]/.test(title)) notes.push("contiene símbolos prohibidos");
  else { score += 5; notes.push("sin símbolos prohibidos"); }

  const firstSegment = title.split(/[|·\-–—]/)[0]?.trim() ?? "";
  if (firstSegment.length <= 45) { score += 5; notes.push("keyword al inicio"); }

  if (GENERIC_PHRASES.test(title)) {
    score -= 5;
    notes.push("frase genérica/plantilla detectada en el título");
  }

  return { score: Math.max(0, Math.min(25, score)), notes };
}

const CONCEPTO_FORMAT = /^[A-ZÁÉÍÓÚÑ\s]{2,}:\s/;

// Formato A ("CONCEPTO: detalle") and Formato B (a plain benefit sentence,
// no fixed punctuation) are both sanctioned by buildSystemPrompt — Formato B
// is the deliberate fallback for bullets with too little data for Formato
// A's ALL-CAPS lead-in ("usa el Formato B para ese bullet en vez de forzar
// el Formato A"). A bullet correctly following Formato B must not score as
// "wrong format" — it's doing exactly what the prompt asked for.
//
// Known limitation: this is a syntactic check only (capitalized start + word
// count), not a semantic one. A real regression (auriculares/plastic.es)
// produced a bullet that was meta-commentary echoing the prompt's own rule
// text ("La consecuencia emocional de esta autonomía es...") rather than a
// genuine product benefit — it satisfied this check and would score as
// well-formatted despite being poor content. Catching that requires judging
// meaning, which a deterministic, no-AI-call scorer can't do; the fix for
// that specific echo lives in the prompt (prompts.ts), not here.
function isWellFormattedBullet(b: string): boolean {
  if (CONCEPTO_FORMAT.test(b)) return true;
  const trimmed = b.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  // A bullet leading with a concrete number ("100% ALGODÓN...", "200 g/m²
  // DE GRAMAJE...") is legitimate, concrete content — not a formatting
  // defect. Formato A's regex can't match it (digits/units aren't in the
  // ALL-CAPS-only class), so Formato B is the fallback; it shouldn't require
  // the first character to be a letter when a leading digit is exactly the
  // concrete-data-first style the prompt's own TÍTULO rule asks for.
  return /^[A-ZÁÉÍÓÚÑ0-9]/.test(trimmed) && words.length >= 4 && words.length <= 18;
}

const STOPWORDS = new Set(["de", "la", "el", "los", "las", "que", "con", "para", "por", "en", "un", "una", "y", "o", "tu", "su", "del", "al", "sin", "más", "este", "esta"]);

function significantWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

// Jaccard-style overlap on content words (min-size normalized) — catches two
// bullets that restate the same idea in different words, which the format
// check alone can't see (both can be perfectly "CONCEPTO: detalle" shaped).
function overlapRatio(a: string, b: string): number {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

export function analyzeBullets(bullets: string[] | null): ScoreResult {
  if (!bullets?.length) return { score: 0, notes: ["sin bullets generados"] };
  const count = bullets.length;
  let score = 0;
  const notes: string[] = [];

  if (count >= 4 && count <= 7) { score += 15; notes.push(`${count} bullets`); }
  else { score += 5; notes.push(`${count} bullets (ideal: 4-7)`); }

  const formatted = bullets.filter(isWellFormattedBullet);
  if (formatted.length === count) { score += 20; notes.push("todos con formato correcto ✓"); }
  else if (formatted.length > 0) { score += 10; notes.push(`${count - formatted.length} sin formato correcto`); }
  else notes.push("ninguno sigue el Formato A o B (ver reglas de bullets)");

  // Detect strongest (most data-rich) bullet not in position 0
  const dataRe = /\b\d+\s*(?:%|g\b|kg\b|ml\b|l\b|cm\b|mm\b|m\b|h\b|min\b|€|\$|w\b|mah\b|db\b)/i;
  const richIdx = bullets.findIndex((b) => dataRe.test(b));
  if (richIdx > 0) notes.push(`💡 bullet ${richIdx + 1} tiene más datos — muévelo al primero`);

  let redundantPairs = 0;
  for (let i = 0; i < bullets.length; i++) {
    for (let j = i + 1; j < bullets.length; j++) {
      if (overlapRatio(bullets[i], bullets[j]) > 0.5) redundantPairs++;
    }
  }
  let penalty = 0;
  if (redundantPairs > 0) {
    penalty = Math.min(15, redundantPairs * 5);
    notes.push(`${redundantPairs} par(es) de bullets muy similares entre sí — aportan poca información nueva`);
  }

  return { score: Math.max(0, Math.min(35, score - penalty)), notes };
}

const VALID_HOOK_TYPES = ["scene", "question", "bold", "benefit"];

export function analyzeDescription(description: string | null, hookType?: string | null): ScoreResult {
  if (!description?.trim()) return { score: 0, notes: ["sin descripción generada"] };
  const words = description.trim().split(/\s+/).length;
  let score = 0;
  const notes: string[] = [];

  if (words >= 120 && words <= 280) { score += 20; notes.push(`${words} palabras`); }
  else if (words < 120) { score += 8; notes.push(`${words} palabras (mín 120)`); }
  else { score += 12; notes.push(`${words} palabras (máx 280)`); }

  // hook_type is the authoritative signal when present (stored on every
  // listing generated after that column existed) — it recognizes all 4 hook
  // types the prompt supports (scene/question/bold/benefit). The regex
  // fallback below only recognized 2 of those (Future Pacing + a narrow
  // formal-tone pattern), silently scoring 0 for a correctly-executed
  // scene/question/bold hook. Used only for legacy rows with no hook_type.
  if (hookType && VALID_HOOK_TYPES.includes(hookType)) {
    score += 10;
    notes.push(`gancho "${hookType}" ✓`);
  } else {
    const isFormalTone = /^esta |^el diseño|^la composición|^este producto/i.test(description.trim()) && !/imagina|piensa en/i.test(description);
    if (/imagina|piensa en/i.test(description)) { score += 10; notes.push("Future Pacing ✓"); }
    else if (isFormalTone) { score += 10; notes.push("Estructura formal ✓"); }
    else notes.push("falta Future Pacing");
  }

  // The CIERRE rule in buildSystemPrompt explicitly offers 3 equivalent
  // closing patterns ("el resultado es...", "lo que notas desde el primer
  // día...", "sin tener que..."), but this only ever checked the first —
  // a closing correctly following the prompt's own second or third example
  // scored 0 for the closing beat.
  const CLOSING_PATTERNS = /el resultado|desde el primer día|sin tener que/i;
  if (CLOSING_PATTERNS.test(description)) { score += 10; notes.push("cierre 'El resultado/primer día/sin tener que' ✓"); }
  else notes.push("falta cierre 'El resultado'");

  if (GENERIC_PHRASES.test(firstSentence(description))) {
    score -= 8;
    notes.push("apertura genérica/plantilla detectada — no dice nada específico de este producto");
  }

  return { score: Math.max(0, Math.min(40, score)), notes };
}

// Rewards copy that actually reflects the product's confirmed attributes
// instead of leaning entirely on generic adjectives. Skipped entirely when
// no attributes were confirmed — buildUserPrompt() already forbids inventing
// data in that case (see the "ATENCIÓN: este producto no tiene atributos
// confirmados" branch), so there's nothing real to check the copy against.
export function analyzeSpecificity(
  combinedText: string,
  attributes?: Record<string, string> | null
): { penalty: number; note: string | null } {
  const values = attributes ? Object.values(attributes).filter(Boolean) : [];
  if (values.length === 0) return { penalty: 0, note: null };

  const lower = combinedText.toLowerCase();
  const used = values.filter((v) => lower.includes(String(v).toLowerCase()));
  if (used.length === 0) {
    return { penalty: 10, note: "ningún atributo confirmado aparece en el copy — revisa que no sea puro relleno genérico" };
  }
  return { penalty: 0, note: `${used.length}/${values.length} atributos confirmados reflejados en el copy` };
}

// Ficha Técnica descriptions are detected structurally (via the "## " section
// markers, see render-sections.ts) rather than a stored mode column — no
// schema change needed. Word-count target and "required sections present"
// replace the short-mode's Future Pacing / "el resultado" checks, which don't
// apply to an intentionally neutral, informative document.
const REQUIRED_TECNICA_SECTIONS = ["especificaciones técnicas", "instalación", "preguntas frecuentes"];

export function analyzeDescriptionTecnica(description: string | null): ScoreResult {
  if (!description?.trim()) return { score: 0, notes: ["sin descripción generada"] };
  const words = description.trim().split(/\s+/).length;
  let score = 0;
  const notes: string[] = [];

  if (words >= 400 && words <= 750) { score += 20; notes.push(`${words} palabras`); }
  else if (words < 400) { score += 10; notes.push(`${words} palabras (mín 400 recomendado)`); }
  else { score += 15; notes.push(`${words} palabras (máx 750 recomendado)`); }

  const headings = parseDescriptionSections(description)
    .map((s) => s.heading?.trim().toLowerCase())
    .filter((h): h is string => !!h);
  const present = REQUIRED_TECNICA_SECTIONS.filter((s) => headings.includes(s));
  if (present.length === REQUIRED_TECNICA_SECTIONS.length) {
    score += 20;
    notes.push("las 3 secciones presentes ✓");
  } else if (present.length > 0) {
    score += 10;
    const missing = REQUIRED_TECNICA_SECTIONS.filter((s) => !present.includes(s));
    notes.push(`faltan secciones: ${missing.join(", ")}`);
  } else {
    notes.push("no se detectan los marcadores de sección '## '");
  }

  return { score: Math.min(40, score), notes };
}

export interface HealthScoreListing {
  status?: string;
  generationMode?: string | null;
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
  hookType?: string | null;
  attributes?: Record<string, string> | null;
}

// generationMode is the authoritative signal when present (set on every listing
// generated after that column was added); hasSections() is a content-sniffing
// fallback for legacy rows generated before the column existed.
function isTecnicaDescription(listing: {
  generationMode?: string | null;
  generatedDescription?: string | null;
}): boolean {
  if (listing.generationMode) return listing.generationMode === "tecnica";
  return !!listing.generatedDescription && hasSections(listing.generatedDescription);
}

export function scoreDescription(listing: {
  generationMode?: string | null;
  generatedDescription: string | null;
  hookType?: string | null;
}): ScoreResult {
  return isTecnicaDescription(listing)
    ? analyzeDescriptionTecnica(listing.generatedDescription)
    : analyzeDescription(listing.generatedDescription, listing.hookType);
}

export function calcHealthScore(listing: HealthScoreListing): number {
  if (listing.status && listing.status !== "COMPLETED") return 0;
  const total =
    analyzeTitle(listing.generatedTitle).score +
    analyzeBullets(listing.generatedBullets).score +
    scoreDescription(listing).score;

  const combinedText = [
    listing.generatedBullets?.join(" ") ?? "",
    listing.generatedDescription ?? "",
  ].join(" ");
  const { penalty } = analyzeSpecificity(combinedText, listing.attributes);

  return Math.max(0, total - penalty);
}
