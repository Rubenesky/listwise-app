import { POST } from "@/app/api/listings/analyze-source/route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ ratelimitEnrichedInput: { limit: jest.fn() } }));
jest.mock("@/lib/security/ssrf", () => ({ validateUrlSSRF: jest.fn() }));
jest.mock("@/lib/scraping/extract-text", () => ({ fetchAndExtractText: jest.fn() }));
jest.mock("@/lib/pdf/extract-text", () => ({ extractTextFromPdf: jest.fn() }));
jest.mock("@/lib/ai/extract-product-info", () => ({ extractProductInfoFromText: jest.fn() }));

import { auth } from "@clerk/nextjs/server";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { validateUrlSSRF } from "@/lib/security/ssrf";
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";

function makeUrlRequest(url: string): Request {
  const fd = new FormData();
  fd.append("url", url);
  return new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: fd });
}

function makePdfRequest(file: File): Request {
  const fd = new FormData();
  fd.append("file", file);
  return new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: fd });
}

describe("POST /api/listings/analyze-source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: true });
  });

  it("returns 401 when not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    (ratelimitEnrichedInput.limit as jest.Mock).mockResolvedValue({ success: false });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    expect(res.status).toBe(429);
  });

  it("returns 400 when neither url nor file is provided", async () => {
    const res = await POST(new Request("http://localhost/api/listings/analyze-source", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });

  it("analyzes a URL: validates SSRF, fetches, extracts product info", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: true, normalized: "https://example.com/producto" });
    (fetchAndExtractText as jest.Mock).mockResolvedValue({ title: "Producto", text: "texto extraído de la página" });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue({
      productName: "Persiana X", category: "hogar", attributes: { material: "aluminio" }, primaryKeyword: "persiana x", confidence: 0.8,
    });
    const res = await POST(makeUrlRequest("https://example.com/producto"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.productInfo.productName).toBe("Persiana X");
    expect(validateUrlSSRF).toHaveBeenCalledWith("https://example.com/producto");
  });

  it("returns an error when the URL fails SSRF validation, without calling fetchAndExtractText", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: false, error: "La URL apunta a una red interna" });
    const res = await POST(makeUrlRequest("http://169.254.169.254/"));
    expect(res.status).toBe(400);
    expect(fetchAndExtractText).not.toHaveBeenCalled();
  });

  it("analyzes a PDF: extracts text, extracts product info", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: true, text: "texto del pdf", numPages: 2 });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue({
      productName: "Mosquitera Y", category: "hogar", attributes: {}, primaryKeyword: "mosquitera y", confidence: 0.6,
    });
    const file = new File(["contenido"], "ficha.pdf", { type: "application/pdf" });
    const res = await POST(makePdfRequest(file));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.productInfo.productName).toBe("Mosquitera Y");
  });

  it("rejects a non-PDF file with 400", async () => {
    const file = new File(["x"], "imagen.png", { type: "image/png" });
    const res = await POST(makePdfRequest(file));
    expect(res.status).toBe(400);
  });

  it("returns 422 with scannedPdf when the PDF has no extractable text, without calling extractProductInfoFromText", async () => {
    (extractTextFromPdf as jest.Mock).mockResolvedValue({ hasText: false, text: "", numPages: 3 });
    const file = new File(["contenido"], "escaneado.pdf", { type: "application/pdf" });
    const res = await POST(makePdfRequest(file));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.scannedPdf).toBe(true);
    expect(extractProductInfoFromText).not.toHaveBeenCalled();
  });

  it("returns a clear error when extractProductInfoFromText cannot identify a product", async () => {
    (validateUrlSSRF as jest.Mock).mockResolvedValue({ ok: true, normalized: "https://example.com/x" });
    (fetchAndExtractText as jest.Mock).mockResolvedValue({ title: "", text: "texto irrelevante" });
    (extractProductInfoFromText as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeUrlRequest("https://example.com/x"));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBeTruthy();
  });
});
