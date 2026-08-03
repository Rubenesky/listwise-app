import { extractTextFromPdf } from "@/lib/pdf/extract-text";

jest.mock("pdf-parse", () => jest.fn());
import pdfParse from "pdf-parse";
const mockPdfParse = pdfParse as unknown as jest.Mock;

describe("extractTextFromPdf", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports hasText=true when there is enough text per page", async () => {
    mockPdfParse.mockResolvedValue({
      text: "A".repeat(200),
      numpages: 2,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.hasText).toBe(true);
    expect(result.numPages).toBe(2);
  });

  it("reports hasText=false for a scanned PDF (below 50 chars/page)", async () => {
    mockPdfParse.mockResolvedValue({
      text: "",
      numpages: 3,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.hasText).toBe(false);
  });

  it("truncates extracted text to 10000 chars", async () => {
    mockPdfParse.mockResolvedValue({
      text: "B".repeat(20000),
      numpages: 1,
    });
    const result = await extractTextFromPdf(Buffer.from("fake-pdf"));
    expect(result.text.length).toBe(10000);
  });
});
