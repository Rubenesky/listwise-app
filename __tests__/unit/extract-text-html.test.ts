import { extractTextFromHtml, fetchAndExtractText } from "@/lib/scraping/extract-text";
import * as ssrfModule from "@/lib/security/ssrf";

jest.mock("@/lib/security/ssrf");

describe("extractTextFromHtml", () => {
  it("extracts title and body paragraphs, stripping scripts/nav", () => {
    const html = `
      <html><head><title>Fallback Title</title></head>
      <body>
        <nav>Menú de navegación</nav>
        <script>console.log("no debe aparecer")</script>
        <h1>Persiana Veneciana Aluminio</h1>
        <p>Fabricada en aluminio anodizado de 25mm de espesor.</p>
        <footer>Pie de página</footer>
      </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("Persiana Veneciana Aluminio");
    expect(result.text).toContain("Fabricada en aluminio anodizado");
    expect(result.text).not.toContain("Menú de navegación");
    expect(result.text).not.toContain("no debe aparecer");
    expect(result.text).not.toContain("Pie de página");
  });

  it("falls back to <title> when there is no h1 or og:title", () => {
    const html = `<html><head><title>Solo Title</title></head><body><p>Texto breve pero suficiente para el test</p></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.title).toBe("Solo Title");
  });

  it("ignores very short paragraph fragments", () => {
    const html = `<html><body><p>Hi</p><p>Este párrafo sí tiene contenido suficiente</p></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result.text).not.toContain("Hi");
    expect(result.text).toContain("Este párrafo sí tiene contenido suficiente");
  });
});

describe("fetchAndExtractText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects URLs that fail SSRF validation", async () => {
    const mockValidateUrlSSRF = jest.spyOn(ssrfModule, "validateUrlSSRF");
    mockValidateUrlSSRF.mockResolvedValue({
      ok: false,
      error: "La URL apunta a una red interna",
    });

    await expect(fetchAndExtractText("http://169.254.169.254/")).rejects.toThrow(
      "La URL apunta a una red interna"
    );

    expect(mockValidateUrlSSRF).toHaveBeenCalledWith("http://169.254.169.254/");
  });
});
