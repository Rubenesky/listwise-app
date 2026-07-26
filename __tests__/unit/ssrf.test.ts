import { validateUrlSSRF } from "@/lib/security/ssrf";

describe("validateUrlSSRF", () => {
  it("rejects non-http(s) schemes", async () => {
    const result = await validateUrlSSRF("ftp://example.com/file");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost", async () => {
    const result = await validateUrlSSRF("http://localhost/admin");
    expect(result.ok).toBe(false);
  });

  it("rejects raw private IPv4 addresses", async () => {
    const result = await validateUrlSSRF("http://192.168.1.1/");
    expect(result.ok).toBe(false);
  });

  it("rejects cloud metadata IP", async () => {
    const result = await validateUrlSSRF("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed URLs", async () => {
    const result = await validateUrlSSRF("not a url");
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed public https URL", async () => {
    const result = await validateUrlSSRF("https://example.com/product/123");
    expect(result.ok).toBe(true);
    expect(result.normalized).toBe("https://example.com/product/123");
  });
});
