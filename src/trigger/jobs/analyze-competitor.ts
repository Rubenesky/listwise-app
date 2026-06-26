import { task } from "@trigger.dev/sdk/v3";
import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { providers, getDefaultProvider } from "@/lib/ai/providers";
import { isSPADomain, hasScrapingProvider, scrapeWithJSRendering, extractFromUrlSlug } from "@/lib/scraping/providers";

export interface CompetitorAnalysisPayload {
  analysisId: string;
  url: string;
  userId: string;
  listingTitle?: string;
  listingDescription?: string;
}

interface CompetitorAnalysis {
  tone: string;
  strengths: string[];
  weaknesses: string[];
  keywords: string[];
  suggestions: string[];
}

interface ScrapedData {
  title: string;
  description: string;
  keywords: string;
  mainContent: string;
}

const MAX_REDIRECTS = 3;
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
} as const;

// Mobile headers: SHEIN/Temu sometimes bypass Cloudflare's desktop challenge for mobile UAs
const MOBILE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
} as const;

// SHEIN domains that need the 3-layer free strategy
const SHEIN_DOMAINS = ["shein.com", "shein.es", "es.shein.com", "m.shein.com"];

function isSheinDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SHEIN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`) || host.includes("shein."));
  } catch {
    return false;
  }
}

function isCloudflareBlocked(html: string): boolean {
  return (
    html.includes("cf-browser-verification") ||
    html.includes("Just a moment") ||
    html.includes("Checking your browser") ||
    html.includes("Enable JavaScript and cookies") ||
    html.includes("cf_clearance") ||
    (html.includes("cloudflare") && html.length < 5000)
  );
}

function isSafeRedirectUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (/^localhost$/i.test(host) || /^0\.0\.0\.0$/.test(host)) return false;
  if (/^\[/.test(host)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (
      a === 0 || a === 10 || a === 127 || a === 255 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) return false;
  }
  return true;
}

function isContentPoor(data: ScrapedData): boolean {
  if (!data.title || data.title.length < 15) return true;
  if (data.mainContent.length < 150) return true;
  return false;
}

function parseHtml(html: string): ScrapedData {
  const $ = cheerio.load(html);

  let jsonLdTitle = "";
  let jsonLdDescription = "";
  let jsonLdPrice = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdTitle) return;
    try {
      const raw = $(el).html() ?? "";
      const data = JSON.parse(raw) as unknown;
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const typed = item as Record<string, unknown>;
        const t = typed["@type"];
        if (t === "Product" || t === "ItemPage" || t === "Offer") {
          if (typeof typed.name === "string") jsonLdTitle = typed.name.slice(0, 200);
          if (typeof typed.description === "string") jsonLdDescription = typed.description.slice(0, 500);
          const offers = typed.offers as Record<string, unknown> | undefined;
          if (offers && typeof offers.price === "string") jsonLdPrice = offers.price;
          if (offers && typeof offers.price === "number") jsonLdPrice = String(offers.price);
          if (jsonLdTitle) break;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!jsonLdTitle) {
    $("script:not([src])").each((_, el) => {
      if (jsonLdTitle) return;
      const src = $(el).html() ?? "";
      const nameMatch = src.match(/"(?:name|productName|goodsName|title|itemName)"\s*:\s*"([^"]{5,200})"/);
      const priceMatch = src.match(/"(?:price|salePrice|retailPrice|retailPriceAmount)"\s*:\s*"?([0-9.,]{1,12})"?/);
      if (nameMatch && nameMatch[1].length > 5 && !nameMatch[1].startsWith("http")) {
        jsonLdTitle = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, "").trim().slice(0, 200);
      }
      if (priceMatch && !jsonLdPrice) jsonLdPrice = priceMatch[1];
    });
  }

  $("script, style, nav, footer, header, iframe, noscript, svg, [hidden]").remove();

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const imgAlt = $("img[alt]")
    .filter((_, el) => {
      const alt = $(el).attr("alt") ?? "";
      return alt.length > 10 && alt.length < 200 &&
        !alt.toLowerCase().includes("logo") &&
        !alt.toLowerCase().includes("banner");
    })
    .first()
    .attr("alt")
    ?.trim();

  const title =
    jsonLdTitle ||
    ogTitle?.slice(0, 200) ||
    imgAlt?.slice(0, 200) ||
    $("h1").first().text().trim().slice(0, 200) ||
    $("title").first().text().trim().slice(0, 200) ||
    "";

  const description =
    jsonLdDescription ||
    $('meta[property="og:description"]').attr("content")?.trim().slice(0, 500) ||
    $('meta[name="description"]').attr("content")?.trim().slice(0, 500) ||
    "";

  const keywords = $('meta[name="keywords"]').attr("content")?.trim().slice(0, 300) || "";

  const productTextNodes: string[] = [];
  $("h1, h2").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 5 && text.length < 300) productTextNodes.push(`[TÍTULO] ${text}`);
  });
  $(
    "[class*='price'],[class*='Price'],[class*='amount'],[class*='Amount'],[itemprop='price'],[class*='cost'],[class*='Cost']"
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 30 && /[\d.,€$£¥]/.test(text)) {
      productTextNodes.push(`[PRECIO] ${text}`);
    }
  });
  if (jsonLdPrice) productTextNodes.push(`[PRECIO] ${jsonLdPrice}`);
  $("ul li, ol li").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 200) productTextNodes.push(`[BULLET] ${text}`);
  });
  $(
    "p, [class*='desc'],[class*='Desc'],[class*='detail'],[class*='Detail'],[class*='feature'],[class*='Feature'],[class*='material'],[class*='Material']"
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30 && text.length < 600) productTextNodes.push(text);
  });
  const mainContent = productTextNodes.slice(0, 80).join("\n").slice(0, 4000);

  return { title, description, keywords, mainContent };
}

async function fetchNormal(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(currentUrl, { signal: controller.signal, redirect: "manual", headers: FETCH_HEADERS });
    } finally {
      clearTimeout(timeout);
    }
    if (res.status >= 300 && res.status < 400) {
      if (attempt >= MAX_REDIRECTS) throw new Error("Demasiadas redirecciones");
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirección sin Location header");
      const nextUrl = new URL(location, currentUrl).href;
      if (!isSafeRedirectUrl(nextUrl)) throw new Error("Redirección a URL no permitida");
      currentUrl = nextUrl;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("La URL no devuelve HTML");
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) throw new Error("Respuesta demasiado grande");
    return new TextDecoder().decode(arrayBuffer);
  }
  throw new Error("Demasiadas redirecciones");
}

// Layer 1: try mobile UA fetch (free, bypasses Cloudflare on some SHEIN regions)
async function fetchMobile(url: string): Promise<string | null> {
  try {
    // Convert desktop URL to mobile subdomain when applicable
    const mobileUrl = url.replace(/^(https?:\/\/)(www\.|es\.)?shein\./, "$1m.shein.");
    const res = await fetch(mobileUrl, {
      headers: MOBILE_HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const html = new TextDecoder().decode(ab);
    if (isCloudflareBlocked(html)) {
      console.log(`🔒 [Competitor] Cloudflare detectado en fetch móvil`);
      return null;
    }
    return html;
  } catch {
    return null;
  }
}

// SHEIN-specific 3-layer free strategy:
// Layer 1: mobile UA fetch
// Layer 2: Zenrows/ScrapingBee free tier (if configured)
// Layer 3: slug extraction (guaranteed title — always works)
async function scrapeShein(url: string): Promise<ScrapedData & { dataSource: string }> {
  // Always extract from slug as baseline — the slug IS the product title
  const { title: slugTitle, goodsId } = extractFromUrlSlug(url);
  console.log(`📎 [Competitor/SHEIN] Slug extraído: "${slugTitle}" (ID: ${goodsId})`);

  // Layer 1: mobile fetch
  const mobileHtml = await fetchMobile(url);
  if (mobileHtml) {
    const parsed = parseHtml(mobileHtml);
    if (!isContentPoor(parsed)) {
      console.log(`✅ [Competitor/SHEIN] Layer 1 (móvil) exitoso: "${parsed.title.slice(0, 60)}"`);
      // Use slug title if parsed title is worse
      if (slugTitle && (parsed.title.length < 20 || parsed.title.toLowerCase().includes("shein"))) {
        parsed.title = slugTitle;
      }
      return { ...parsed, dataSource: "mobile_fetch" };
    }
  }

  // Layer 2: JS rendering (Zenrows/ScrapingBee if configured)
  if (hasScrapingProvider()) {
    try {
      console.log(`🌐 [Competitor/SHEIN] Layer 2 (JS rendering) para ${url}`);
      const jsHtml = await scrapeWithJSRendering(url);
      if (!isCloudflareBlocked(jsHtml)) {
        const parsed = parseHtml(jsHtml);
        if (!isContentPoor(parsed)) {
          console.log(`✅ [Competitor/SHEIN] Layer 2 (JS rendering) exitoso`);
          if (slugTitle && parsed.title.length < 20) parsed.title = slugTitle;
          return { ...parsed, dataSource: "js_rendering" };
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Competitor/SHEIN] Layer 2 falló: ${err}`);
    }
  }

  // Layer 3: slug-only fallback — guaranteed, always works
  console.log(`📎 [Competitor/SHEIN] Layer 3 (slug): usando título del URL`);
  const mainContent = [
    slugTitle ? `[TÍTULO] ${slugTitle}` : "",
    `[PLATAFORMA] SHEIN`,
    goodsId ? `[ID PRODUCTO] ${goodsId}` : "",
    `[NOTA] Datos extraídos del slug de URL (protección anti-bot activa)`,
  ].filter(Boolean).join("\n");

  return {
    title: slugTitle || "Producto SHEIN",
    description: "",
    keywords: "",
    mainContent,
    dataSource: "url_slug",
  };
}

// Smart dual-strategy scraper
async function scrapeUrl(url: string): Promise<ScrapedData & { dataSource?: string }> {
  const hasProvider = hasScrapingProvider();

  // SHEIN: use dedicated 3-layer strategy
  if (isSheinDomain(url)) {
    return scrapeShein(url);
  }

  const spa = isSPADomain(url);

  // Other SPA domain → JS rendering if available, mobile UA fallback otherwise
  if (spa && !hasProvider) {
    console.log(`📱 [Competitor] SPA sin provider (${new URL(url).hostname}), intentando mobile UA`);
    try {
      const mobileHtml = await fetchMobile(url);
      if (mobileHtml) {
        const parsed = parseHtml(mobileHtml);
        if (!isContentPoor(parsed)) return parsed;
      }
    } catch {
      // fall through to normal fetch
    }
  }

  if (spa && hasProvider) {
    console.log(`🌐 [Competitor] SPA detectado (${new URL(url).hostname}), usando JS rendering`);
    const html = await scrapeWithJSRendering(url);
    return parseHtml(html);
  }

  // Normal fetch first
  let html: string;
  try {
    html = await fetchNormal(url);
  } catch (fetchErr) {
    if (!hasProvider) throw fetchErr;
    console.warn(`⚠️ [Competitor] Fetch normal falló (${fetchErr}), usando JS rendering`);
    const jsHtml = await scrapeWithJSRendering(url);
    return parseHtml(jsHtml);
  }

  const result = parseHtml(html);

  // Content too poor → upgrade to JS rendering
  if (isContentPoor(result) && hasProvider) {
    console.log(`⚠️ [Competitor] Contenido pobre (título: "${result.title}"), usando JS rendering`);
    try {
      const jsHtml = await scrapeWithJSRendering(url);
      return parseHtml(jsHtml);
    } catch (jsErr) {
      console.warn(`⚠️ [Competitor] JS rendering falló (${jsErr}), usando resultado normal`);
      return result;
    }
  }

  return result;
}

export const analyzeCompetitorTask = task({
  id: "analyze-competitor",
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2000,
    factor: 2,
  },
  run: async (payload: CompetitorAnalysisPayload) => {
    console.log(`🔍 [Competitor] Analizando: ${payload.url}`);

    await db
      .update(schema.competitorAnalyses)
      .set({ status: "PROCESSING", updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.competitorAnalyses.id, payload.analysisId));

    let scraped: ScrapedData;
    try {
      scraped = await scrapeUrl(payload.url);
      console.log(`✅ [Competitor] Scraping OK: título="${scraped.title.slice(0, 80)}" contenido=${scraped.mainContent.length}ch`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de scraping";
      console.error("❌ [Competitor] Error scraping:", err);
      await db
        .update(schema.competitorAnalyses)
        .set({ status: "FAILED", errorMessage: msg, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.competitorAnalyses.id, payload.analysisId));
      return { success: false, error: msg };
    }

    const dataSource = (scraped as { dataSource?: string }).dataSource;
    const isSlugOnly = dataSource === "url_slug";
    const sheinContext = isSheinDomain(payload.url)
      ? `\n[PLATAFORMA] SHEIN — marketplace de moda ultra-fast-fashion con títulos muy keyword-stuffed, precios agresivos y audiencia mobile-first.`
      : "";

    const slugNote = isSlugOnly
      ? `\nNOTA: Solo se pudo extraer el título del slug de la URL (protección anti-bot activa en SHEIN). Analiza la calidad del título como copywriter experto en SHEIN y sugiere mejoras reales basadas en él.`
      : "";

    const userPrompt = `Analiza este LISTING ESPECÍFICO de producto de un competidor de ecommerce:

=== DATOS DEL PRODUCTO ===${sheinContext}
NOMBRE/TÍTULO: ${scraped.title || "(no detectado)"}
DESCRIPCIÓN: ${scraped.description || "(no detectada)"}
CONTENIDO DE LA PÁGINA:
${scraped.mainContent.slice(0, 2500)}
${scraped.keywords ? `\nKEYWORDS META: ${scraped.keywords}` : ""}${slugNote}
${payload.listingTitle ? `\n=== MI LISTING ACTUAL (para comparar) ===\nTÍTULO: ${payload.listingTitle}\nDESCRIPCIÓN: ${payload.listingDescription ?? ""}` : ""}

Analiza el COPY y LISTING del producto específico: título, bullets, descripción, precio, tono de venta.
NO analices la web en general — analiza solo cómo venden ESTE producto concreto.
Si los datos son limitados (solo título), analiza exhaustivamente la calidad del título: estructura, keywords, claridad, longitud, elementos faltantes, potencial SEO en marketplace.
Basa tu análisis únicamente en los datos reales proporcionados arriba.

Responde SOLO con JSON válido:
{"tone":"string (ej: emocional, técnico, aspiracional, urgencia, minimalista)","strengths":["fortaleza específica del copy de ESTE producto"],"weaknesses":["debilidad específica del copy de ESTE producto"],"keywords":["keyword relevante extraída del contenido real"],"suggestions":["acción concreta para mejorar MI listing basada en este análisis"]}`;

    let analysis: CompetitorAnalysis;
    try {
      const provider = getDefaultProvider();
      const config = providers[provider];
      console.log(`🤖 [Competitor] Proveedor IA: ${provider}`);

      const response = await config.client.chat.completions.create({
        model: config.defaultModel,
        messages: [
          {
            role: "system",
            content:
              "Eres un experto en copywriting de ecommerce y análisis de listings de productos (Amazon, Shopify, Etsy, SHEIN, Temu, Zara...). Tu especialidad es analizar el copy de un listing específico: título, bullets de características, descripción, precio y tono persuasivo. Evalúas qué tan efectivo es para convertir compradores y para SEO de marketplace. NUNCA analices la web en general — solo el producto específico cuyos datos se te proporcionan. Si los datos están incompletos, analiza lo que hay disponible. Responde SIEMPRE con JSON válido.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      });

      const text = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const toStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.slice(0, 5).map((s) => String(s).slice(0, 400)) : [];

      analysis = {
        tone: typeof parsed.tone === "string" ? parsed.tone.slice(0, 100) : "No determinado",
        strengths: toStrArr(parsed.strengths),
        weaknesses: toStrArr(parsed.weaknesses),
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.slice(0, 10).map((s) => String(s).slice(0, 60))
          : [],
        suggestions: toStrArr(parsed.suggestions),
      };
    } catch (aiErr) {
      console.error("❌ [Competitor] Error IA:", aiErr);
      await db
        .update(schema.competitorAnalyses)
        .set({ status: "FAILED", errorMessage: "Error en análisis IA", updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.competitorAnalyses.id, payload.analysisId));
      return { success: false };
    }

    const now = Math.floor(Date.now() / 1000);
    await db
      .update(schema.competitorAnalyses)
      .set({
        status: "COMPLETED",
        scrapedTitle: scraped.title,
        scrapedDescription: scraped.description,
        scrapedKeywords: scraped.keywords,
        analysis,
        cacheExpiresAt: now + 86400,
        updatedAt: now,
      })
      .where(eq(schema.competitorAnalyses.id, payload.analysisId));

    console.log(`✅ [Competitor] Análisis completado: ${payload.analysisId}`);
    return { success: true, analysisId: payload.analysisId };
  },
});
