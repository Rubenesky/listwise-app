export interface AttributeConflict {
  key: string;
  manualValue: string;
  extractedValue: string;
}

export interface MergeResult {
  merged: Record<string, string>;
  conflicts: AttributeConflict[];
}

// Manual (CSV) attributes are treated as ground truth throughout this
// codebase (see the "Atributos confirmados" rule in prompts.ts) — extracted
// specs only fill gaps the user didn't already provide, never override them.
export function mergeAttributesWithPrecedence(
  manual: Record<string, string> | null,
  extracted: Record<string, string> | null
): MergeResult {
  const merged: Record<string, string> = { ...(extracted ?? {}) };
  const conflicts: AttributeConflict[] = [];

  if (manual) {
    for (const [key, value] of Object.entries(manual)) {
      if (extracted && key in extracted && extracted[key] !== value) {
        conflicts.push({ key, manualValue: value, extractedValue: extracted[key] });
      }
      merged[key] = value;
    }
  }

  return { merged, conflicts };
}
