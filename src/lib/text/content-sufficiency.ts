const MIN_SUBSTANTIVE_LINES = 2;
const MIN_SUBSTANTIVE_LINE_LENGTH = 40;
const MIN_SUBSTANTIVE_CHARS = 150;

// Detects sources with essentially nothing to say beyond the product's own
// name (e.g. a page whose "Descripción" just repeats the title, padded with
// boilerplate and navigation). Real generation on such input reliably
// produces degenerate copy (the model echoes its own formatting rules as
// filler when it has too little real substance) — no amount of prompt
// wording fixed that reliably, so this gate stops it before the AI call
// happens at all, rather than hoping the model behaves on hopeless input.
export function hasEnoughContent(text: string, title: string): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const substantive: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalizedTitle && normalized === normalizedTitle) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (line.length > MIN_SUBSTANTIVE_LINE_LENGTH) substantive.push(line);
  }

  const totalChars = substantive.reduce((sum, l) => sum + l.length, 0);
  return substantive.length >= MIN_SUBSTANTIVE_LINES && totalChars >= MIN_SUBSTANTIVE_CHARS;
}
