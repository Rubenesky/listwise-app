import { task } from "@trigger.dev/sdk/v3";
import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { providers, getDefaultProvider } from "@/lib/ai/providers";

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

const MAX_REDIRECTS = 3;
const FETCH_HEADERS = {
  "User-Agent": "ListWise-Analyzer/1.0 (competitor analysis tool; contact@listwise.app)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "es,en;q=0.8",
} as const;

// Validates each redirect destination to prevent SSRF via open-redirect chains
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
  if (/^\[/.test(host)) return false; // raw IPv6

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

async function scrapeUrl(initialUrl: string): Promise<{
  title: string;
  description: string;
  keywords: string;
  mainContent: string;
}> {
  let currentUrl = initialUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;

    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual", // handle each hop ourselves to validate Location
        headers: FETCH_HEADERS,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      if (attempt >= MAX_REDIRECTS) throw new Error("Demasiadas redirecciones");
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirección sin Location header");
      const nextUrl = new URL(location, currentUrl).href; // resolve relative paths
      if (!isSafeRedirectUrl(nextUrl)) {
        console.warn(`⚠️ [Competitor] Redirect bloqueado: ${currentUrl} → ${nextUrl}`);
        throw new Error("Redirección a URL no permitida");
      }
      currentUrl = nextUrl;
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("La URL no devuelve HTML");
    }

    // Cap at 2MB to prevent memory issues
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) throw new Error("Respuesta demasiado grande");
    const html = new TextDecoder().decode(arrayBuffer);

    const $ = cheerio.load(html);

    // 1. Extract JSON-LD product data BEFORE removing scripts
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

    // 2. Try to extract product data from inline scripts (SPA sites like SHEIN)
    if (!jsonLdTitle) {
      $("script:not([src])").each((_, el) => {
        if (jsonLdTitle) return;
        const src = $(el).html() ?? "";
        const nameMatch = src.match(/"(?:name|productName|title)"\s*:\s*"([^"]{5,200})"/);
        const priceMatch = src.match(/"(?:price|salePrice|retailPrice)"\s*:\s*"?([0-9.,]{1,12})"?/);
        if (nameMatch && nameMatch[1].length > 5 && !nameMatch[1].startsWith("http")) {
          jsonLdTitle = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, "").slice(0, 200);
        }
        if (priceMatch && !jsonLdPrice) jsonLdPrice = priceMatch[1];
      });
    }

    $("script, style, nav, footer, header, iframe, noscript, svg, [hidden]").remove();

    // 3. Prioritize: JSON-LD → OG → image alt → h1 → <title>
    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
    const imgAlt = $('img[alt]').filter((_, el) => {
      const alt = $(el).attr("alt") ?? "";
      return alt.length > 10 && alt.length < 200 && !alt.toLowerCase().includes("logo") && !alt.toLowerCase().includes("banner");
    }).first().attr("alt")?.trim();

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

    // 4. Extract product-specific structured content with labels
    const productTextNodes: string[] = [];
    $("h1, h2").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 300) productTextNodes.push(`[TÍTULO] ${text}`);
    });
    $("[class*='price'],[class*='Price'],[class*='amount'],[class*='Amount'],[itemprop='price']").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 0 && text.length < 30 && /[\d.,€$£]/.test(text)) {
        productTextNodes.push(`[PRECIO] ${text}`);
      }
    });
    if (jsonLdPrice) productTextNodes.push(`[PRECIO] ${jsonLdPrice}`);
    $("ul li, ol li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10 && text.length < 200) productTextNodes.push(`[BULLET] ${text}`);
    });
    $("p, [class*='desc'],[class*='Desc'],[class*='detail'],[class*='Detail']").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30 && text.length < 500) productTextNodes.push(text);
    });
    const mainContent = productTextNodes.slice(0, 60).join("\n").slice(0, 3000);

    return { title, description, keywords, mainContent };
  }

  throw new Error("Demasiadas redirecciones");
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

    let scraped: Awaited<ReturnType<typeof scrapeUrl>>;
    try {
      scraped = await scrapeUrl(payload.url);
      console.log(`✅ [Competitor] Scraping OK: "${scraped.title.slice(0, 60)}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de scraping";
      console.error("❌ [Competitor] Error scraping:", err);
      await db
        .update(schema.competitorAnalyses)
        .set({ status: "FAILED", errorMessage: msg, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.competitorAnalyses.id, payload.analysisId));
      return { success: false, error: msg };
    }

    const userPrompt = `Analiza este LISTING ESPECÍFICO de producto de un competidor de ecommerce:

=== DATOS DEL PRODUCTO ===
NOMBRE/TÍTULO: ${scraped.title || "(no detectado)"}
DESCRIPCIÓN: ${scraped.description || "(no detectada)"}
CONTENIDO DE LA PÁGINA:
${scraped.mainContent.slice(0, 2000)}
${scraped.keywords ? `KEYWORDS META: ${scraped.keywords}` : ""}
${payload.listingTitle ? `\n=== MI LISTING ACTUAL (para comparar) ===\nTÍTULO: ${payload.listingTitle}\nDESCRIPCIÓN: ${payload.listingDescription ?? ""}` : ""}

Analiza el COPY y LISTING del producto específico (título, bullets, descripción, precio si lo hay).
NO analices la web en general — analiza solo cómo venden ESTE producto.

Responde SOLO con JSON válido:
{"tone":"string (ej: emocional, técnico, aspiracional, informativo)","strengths":["fortaleza específica del copy/listing"],"weaknesses":["debilidad específica del copy/listing"],"keywords":["keyword relevante del producto"],"suggestions":["acción concreta para mejorar MI listing basada en este análisis"]}`;

    let analysis: CompetitorAnalysis;
    try {
      const provider = getDefaultProvider();
      const config = providers[provider];
      console.log(`🤖 [Competitor] Proveedor: ${provider}`);

      const response = await config.client.chat.completions.create({
        model: config.defaultModel,
        messages: [
          {
            role: "system",
            content:
              "Eres un experto en copywriting de ecommerce y análisis de listings de productos (Amazon, Shopify, Etsy, SHEIN...). Tu especialidad es analizar el copy de un listing específico: título, bullets de características, descripción y precio. Evalúas qué tan efectivo es para convertir compradores y para SEO. Nunca analices la web en general — solo el producto específico. Responde SIEMPRE en JSON válido.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const text = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as Record<string, unknown>;

      const toStrArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.slice(0, 5).map((s) => String(s).slice(0, 300)) : [];

      analysis = {
        tone: typeof parsed.tone === "string" ? parsed.tone.slice(0, 100) : "No determinado",
        strengths: toStrArr(parsed.strengths),
        weaknesses: toStrArr(parsed.weaknesses),
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.slice(0, 10).map((s) => String(s).slice(0, 50))
          : [],
        suggestions: toStrArr(parsed.suggestions),
      };
    } catch (aiErr) {
      console.error("❌ [Competitor] Error IA:", aiErr);
      await db
        .update(schema.competitorAnalyses)
        .set({
          status: "FAILED",
          errorMessage: "Error en análisis IA",
          updatedAt: Math.floor(Date.now() / 1000),
        })
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
        cacheExpiresAt: now + 86400, // cache 24h
        updatedAt: now,
      })
      .where(eq(schema.competitorAnalyses.id, payload.analysisId));

    console.log(`✅ [Competitor] Análisis completado: ${payload.analysisId}`);
    return { success: true, analysisId: payload.analysisId };
  },
});
