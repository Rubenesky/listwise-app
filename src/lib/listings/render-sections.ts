// Parses the "## Sección" markers the Ficha Técnica mode uses to structure a
// long-form description. Descriptions from every other mode have no markers
// and parse as a single section with heading: null — same as today's plain
// rendering, so this is backward compatible with all existing content.

export interface DescriptionSection {
  heading: string | null;
  body: string;
}

const SECTION_HEADING = /^##\s+(.+)$/;

export function hasSections(description: string): boolean {
  return /^##\s+.+$/m.test(description);
}

export function parseDescriptionSections(description: string): DescriptionSection[] {
  const lines = description.split("\n");
  const sections: DescriptionSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body || heading) sections.push({ heading, body });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(SECTION_HEADING);
    if (match) {
      flush();
      heading = match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}
