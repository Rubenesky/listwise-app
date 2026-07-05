import {
  extractFromUrlSlug,
  isSPADomain,
  getDefaultScrapingProvider,
  hasScrapingProvider,
} from "@/lib/scraping/providers";

describe("extractFromUrlSlug", () => {
  it("extracts title and ID from a SHEIN-style URL", () => {
    const result = extractFromUrlSlug("https://www.shein.com/camiseta-manga-corta-p-12345678.html");
    expect(result.goodsId).toBe("12345678");
    expect(result.title).toContain("camiseta manga corta");
  });

  it("extracts title and ID from a Temu-style URL", () => {
    const result = extractFromUrlSlug("https://www.temu.com/zapatillas-deportivas-hombre-p-98765432.html");
    expect(result.goodsId).toBe("98765432");
    expect(result.title).toContain("zapatillas deportivas hombre");
  });

  it("returns null goodsId for URL without -p- pattern", () => {
    const result = extractFromUrlSlug("https://www.amazon.es/dp/B08XYZ123");
    expect(result.goodsId).toBeNull();
    expect(result.title).toBe("");
  });

  it("returns empty result for invalid URL", () => {
    const result = extractFromUrlSlug("not-a-url");
    expect(result.goodsId).toBeNull();
    expect(result.title).toBe("");
  });

  it("returns empty result for empty string", () => {
    const result = extractFromUrlSlug("");
    expect(result.goodsId).toBeNull();
    expect(result.title).toBe("");
  });

  it("converts hyphens in slug to spaces", () => {
    const result = extractFromUrlSlug("https://shein.com/my-product-name-p-11111111");
    expect(result.title).toBe("my product name");
  });
});

describe("isSPADomain", () => {
  it("returns true for shein.com", () => {
    expect(isSPADomain("https://www.shein.com/product")).toBe(true);
  });

  it("returns true for temu.com", () => {
    expect(isSPADomain("https://www.temu.com/product")).toBe(true);
  });

  it("returns true for zara.com", () => {
    expect(isSPADomain("https://www.zara.com/es/product")).toBe(true);
  });

  it("returns true for zalando.es", () => {
    expect(isSPADomain("https://www.zalando.es/product")).toBe(true);
  });

  it("returns false for amazon.com", () => {
    expect(isSPADomain("https://www.amazon.com/dp/B08")).toBe(false);
  });

  it("returns false for unknown domain", () => {
    expect(isSPADomain("https://www.example.com/product")).toBe(false);
  });

  it("returns false for invalid URL", () => {
    expect(isSPADomain("not-a-url")).toBe(false);
  });

  it("strips www prefix before comparing", () => {
    expect(isSPADomain("https://www.aliexpress.com/item/123")).toBe(true);
  });
});

describe("getDefaultScrapingProvider", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.ZENROWS_API_KEY;
    delete process.env.SCRAPINGBEE_API_KEY;
    delete process.env.SCRAPING_PROVIDER;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns zenrows when ZENROWS_API_KEY is set", () => {
    process.env.ZENROWS_API_KEY = "test_key";
    expect(getDefaultScrapingProvider()).toBe("zenrows");
  });

  it("returns scrapingbee when only SCRAPINGBEE_API_KEY is set", () => {
    process.env.SCRAPINGBEE_API_KEY = "test_key";
    expect(getDefaultScrapingProvider()).toBe("scrapingbee");
  });

  it("throws when no provider is configured", () => {
    expect(() => getDefaultScrapingProvider()).toThrow();
  });

  it("respects SCRAPING_PROVIDER when matching key exists", () => {
    process.env.SCRAPING_PROVIDER = "scrapingbee";
    process.env.SCRAPINGBEE_API_KEY = "key";
    process.env.ZENROWS_API_KEY = "key2";
    expect(getDefaultScrapingProvider()).toBe("scrapingbee");
  });
});

describe("hasScrapingProvider", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.ZENROWS_API_KEY;
    delete process.env.SCRAPINGBEE_API_KEY;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns true when ZENROWS_API_KEY is set", () => {
    process.env.ZENROWS_API_KEY = "key";
    expect(hasScrapingProvider()).toBe(true);
  });

  it("returns true when SCRAPINGBEE_API_KEY is set", () => {
    process.env.SCRAPINGBEE_API_KEY = "key";
    expect(hasScrapingProvider()).toBe(true);
  });

  it("returns false when neither key is set", () => {
    expect(hasScrapingProvider()).toBe(false);
  });
});
