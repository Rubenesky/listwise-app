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
    $("script, style, nav, footer, header, iframe, noscript, svg, [hidden]").remove();

    const title =
      $("title").first().text().trim().slice(0, 200) ||
      $("h1").first().text().trim().slice(0, 200) ||
      "";

    const description =
      $('meta[name="description"]').attr("content")?.trim().slice(0, 500) ||
      $('meta[property="og:description"]').attr("content")?.trim().slice(0, 500) ||
      "";

    const keywords = $('meta[name="keywords"]').attr("content")?.trim().slice(0, 300) || "";

    const textNodes: string[] = [];
    $("h1, h2, h3, p, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) textNodes.push(text);
    });
    const mainContent = textNodes.join(" ").slice(0, 3000);

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

    const userPrompt = `Analiza este listing de un competidor:

TÍTULO: ${scraped.title}
DESCRIPCIÓN: ${scraped.description}
KEYWORDS: ${scraped.keywords}
CONTENIDO: ${scraped.mainContent.slice(0, 1500)}
${payload.listingTitle ? `\nMI LISTING ACTUAL:\nTÍTULO: ${payload.listingTitle}\nDESCRIPCIÓN: ${payload.listingDescription ?? ""}` : ""}

Responde SOLO con JSON:
{"tone":"string","strengths":["..."],"weaknesses":["..."],"keywords":["..."],"suggestions":["..."]}`;

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
              "Eres un experto en marketing de ecommerce. Analiza listings de competidores. Responde SIEMPRE en JSON válido.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
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
