import * as cheerio from "cheerio";
import { validateUrlSSRF } from "@/lib/security/ssrf";

export interface ExtractedPage {
  title: string;
  text: string;
}

const MAX_TEXT_CHARS = 10000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB

export function extractTextFromHtml(html: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, iframe, noscript, svg, [hidden]").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "";

  const parts: string[] = [];
  $("h1, h2, h3, p, li").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text.length > 10) parts.push(text);
  });

  return { title: title.slice(0, 200), text: parts.join("\n").slice(0, MAX_TEXT_CHARS) };
}

export async function fetchAndExtractText(url: string): Promise<ExtractedPage> {
  const validation = await validateUrlSSRF(url);
  if (!validation.ok) {
    throw new Error(validation.error || "URL validation failed");
  }

  const normalizedUrl = validation.normalized || url;

  const res = await fetch(normalizedUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ListWiseBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  let received = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_HTML_BYTES) throw new Error("Response too large");
    chunks.push(value);
  }

  const html = Buffer.concat(chunks).toString("utf-8");
  return extractTextFromHtml(html);
}
