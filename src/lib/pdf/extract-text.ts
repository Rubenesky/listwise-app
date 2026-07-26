import pdfParse from "pdf-parse";

export interface PdfExtractionResult {
  hasText: boolean;
  text: string;
  numPages: number;
}

const MIN_CHARS_PER_PAGE = 50;
const MAX_TEXT_CHARS = 10000;

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  const data = await pdfParse(buffer);
  const numPages = data.numpages || 1;
  const text = (data.text || "").trim();
  const hasText = text.length >= MIN_CHARS_PER_PAGE * numPages;
  return { hasText, text: text.slice(0, MAX_TEXT_CHARS), numPages };
}
