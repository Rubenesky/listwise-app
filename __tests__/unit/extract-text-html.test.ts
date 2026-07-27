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
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
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
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects when a redirect hop points at an SSRF-blocked target", async () => {
    const mockValidateUrlSSRF = jest.spyOn(ssrfModule, "validateUrlSSRF");
    // 1st call: initial URL passes validation.
    mockValidateUrlSSRF.mockResolvedValueOnce({
      ok: true,
      normalized: "https://proveedor.com/ficha",
    });
    // 2nd call: the redirect target fails validation (e.g. cloud metadata IP).
    mockValidateUrlSSRF.mockResolvedValueOnce({
      ok: false,
      error: "La URL apunta a una red interna",
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      })
    );

    await expect(fetchAndExtractText("https://proveedor.com/ficha")).rejects.toThrow(
      "La URL apunta a una red interna"
    );

    expect(mockValidateUrlSSRF).toHaveBeenCalledTimes(2);
    expect(mockValidateUrlSSRF).toHaveBeenNthCalledWith(
      2,
      "http://169.254.169.254/latest/meta-data/"
    );
    // Only the initial (redirecting) response should have been fetched — the
    // blocked target must never be requested.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-HTML content-type response", async () => {
    const mockValidateUrlSSRF = jest.spyOn(ssrfModule, "validateUrlSSRF");
    mockValidateUrlSSRF.mockResolvedValue({
      ok: true,
      normalized: "https://proveedor.com/ficha.pdf",
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      })
    );

    await expect(fetchAndExtractText("https://proveedor.com/ficha.pdf")).rejects.toThrow(
      "Response is not HTML"
    );
  });
});
