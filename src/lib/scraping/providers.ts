export type ScrapingProvider = "zenrows" | "scrapingbee";

// Known SPA domains that block normal fetch — go directly to JS rendering
const SPA_DOMAINS = [
  "shein.com",
  "zara.com",
  "hm.com",
  "mango.com",
  "zalando.es",
  "zalando.com",
  "asos.com",
  "bershka.com",
  "pullandbear.com",
  "stradivarius.com",
  "massimo-dutti.com",
  "temu.com",
  "aliexpress.com",
  "wish.com",
];

export function isSPADomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return SPA_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

async function fetchZenrows(url: string): Promise<string> {
  const key = process.env.ZENROWS_API_KEY;
  if (!key) throw new Error("ZENROWS_API_KEY no configurada");
  const apiUrl = `https://api.zenrows.com/v1/?apikey=${key}&url=${encodeURIComponent(url)}&js_render=true&wait_for_selector=body&timeout=15000`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Zenrows HTTP ${res.status}`);
  return res.text();
}

async function fetchScrapingBee(url: string): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) throw new Error("SCRAPINGBEE_API_KEY no configurada");
  const apiUrl = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(url)}&render_js=true&wait=2000&block_ads=true`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`ScrapingBee HTTP ${res.status}`);
  return res.text();
}

export function getDefaultScrapingProvider(): ScrapingProvider {
  const env = process.env.SCRAPING_PROVIDER as ScrapingProvider | undefined;
  if (env === "zenrows" && process.env.ZENROWS_API_KEY) return "zenrows";
  if (env === "scrapingbee" && process.env.SCRAPINGBEE_API_KEY) return "scrapingbee";
  if (process.env.ZENROWS_API_KEY) return "zenrows";
  if (process.env.SCRAPINGBEE_API_KEY) return "scrapingbee";
  throw new Error("Sin proveedor de scraping. Configura ZENROWS_API_KEY o SCRAPINGBEE_API_KEY.");
}

export function hasScrapingProvider(): boolean {
  return !!(process.env.ZENROWS_API_KEY || process.env.SCRAPINGBEE_API_KEY);
}

export async function scrapeWithJSRendering(url: string): Promise<string> {
  const primary = getDefaultScrapingProvider();
  const secondary: ScrapingProvider = primary === "zenrows" ? "scrapingbee" : "zenrows";

  try {
    console.log(`🌐 [Scraping] Usando ${primary} para ${url}`);
    return primary === "zenrows" ? await fetchZenrows(url) : await fetchScrapingBee(url);
  } catch (err) {
    console.warn(`⚠️ [Scraping] ${primary} falló (${err}). Intentando ${secondary}...`);
    return secondary === "zenrows" ? await fetchZenrows(url) : await fetchScrapingBee(url);
  }
}
