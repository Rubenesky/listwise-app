// Rule-based content-quality scoring — no AI call, deterministic from the
// listing's own generated fields. Shared by the dashboard's Health column and
// the Agent's /api/agent/analyze so both report the exact same score.

import { hasSections } from "./render-sections";

export interface ScoreResult {
  score: number;
  notes: string[];
}

export function analyzeTitle(title: string | null): ScoreResult {
  if (!title?.trim()) return { score: 0, notes: ["sin título generado"] };
  const len = title.length;
  let score = 0;
  const notes: string[] = [];

  if (len >= 60 && len <= 200) { score += 15; notes.push(`${len} chars — longitud ideal`); }
  else if (len < 60) { score += 5; notes.push(`${len} chars (mín 60)`); }
  else { score += 8; notes.push(`${len} chars (máx 200)`); }

  if (/[®©™%]/.test(title)) notes.push("contiene símbolos prohibidos");
  else { score += 5; notes.push("sin símbolos prohibidos"); }

  const firstSegment = title.split(/[|·\-–—]/)[0]?.trim() ?? "";
  if (firstSegment.length <= 45) { score += 5; notes.push("keyword al inicio"); }

  return { score: Math.min(25, score), notes };
}

export function analyzeBullets(bullets: string[] | null): ScoreResult {
  if (!bullets?.length) return { score: 0, notes: ["sin bullets generados"] };
  const count = bullets.length;
  let score = 0;
  const notes: string[] = [];

  if (count >= 4 && count <= 7) { score += 15; notes.push(`${count} bullets`); }
  else { score += 5; notes.push(`${count} bullets (ideal: 4-7)`); }

  const formatted = bullets.filter((b) => /^[A-ZÁÉÍÓÚÑ\s]{2,}:\s/.test(b));
  if (formatted.length === count) { score += 20; notes.push("todos con CONCEPTO: ✓"); }
  else if (formatted.length > 0) { score += 10; notes.push(`${count - formatted.length} sin formato CONCEPTO:`); }
  else notes.push("ninguno sigue el formato CONCEPTO: descripción");

  // Detect strongest (most data-rich) bullet not in position 0
  const dataRe = /\b\d+\s*(?:%|g\b|kg\b|ml\b|l\b|cm\b|mm\b|m\b|h\b|min\b|€|\$|w\b|mah\b|db\b)/i;
  const richIdx = bullets.findIndex((b) => dataRe.test(b));
  if (richIdx > 0) notes.push(`💡 bullet ${richIdx + 1} tiene más datos — muévelo al primero`);

  return { score: Math.min(35, score), notes };
}

export function analyzeDescription(description: string | null): ScoreResult {
  if (!description?.trim()) return { score: 0, notes: ["sin descripción generada"] };
  const words = description.trim().split(/\s+/).length;
  let score = 0;
  const notes: string[] = [];

  if (words >= 120 && words <= 280) { score += 20; notes.push(`${words} palabras`); }
  else if (words < 120) { score += 8; notes.push(`${words} palabras (mín 120)`); }
  else { score += 12; notes.push(`${words} palabras (máx 280)`); }

  const isFormalTone = /^esta |^el diseño|^la composición|^este producto/i.test(description.trim()) && !/imagina|piensa en/i.test(description);
  if (/imagina|piensa en/i.test(description)) { score += 10; notes.push("Future Pacing ✓"); }
  else if (isFormalTone) { score += 10; notes.push("Estructura formal ✓"); }
  else notes.push("falta Future Pacing");

  if (/el resultado/i.test(description)) { score += 10; notes.push("cierre 'El resultado' ✓"); }
  else notes.push("falta cierre 'El resultado'");

  return { score: Math.min(40, score), notes };
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

  const lower = description.toLowerCase();
  const present = REQUIRED_TECNICA_SECTIONS.filter((s) => lower.includes(`## ${s}`));
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
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
}

export function calcHealthScore(listing: HealthScoreListing): number {
  if (listing.status && listing.status !== "COMPLETED") return 0;
  const description = listing.generatedDescription;
  const descriptionScore = description && hasSections(description)
    ? analyzeDescriptionTecnica(description).score
    : analyzeDescription(description).score;
  return (
    analyzeTitle(listing.generatedTitle).score +
    analyzeBullets(listing.generatedBullets).score +
    descriptionScore
  );
}
