import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateUrlSSRF } from "@/lib/security/ssrf";
import { ratelimitEnrichedInput } from "@/lib/rate-limit";
import { fetchAndExtractText } from "@/lib/scraping/extract-text";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractProductInfoFromText } from "@/lib/ai/extract-product-info";
import { log } from "@/lib/logger";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { success } = await ratelimitEnrichedInput.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Límite diario de fuentes enriquecidas alcanzado (10/día). Inténtalo mañana." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const url = formData.get("url");
    const file = formData.get("file");

    let extractedText: string;

    if (typeof url === "string" && url.trim()) {
      const check = await validateUrlSSRF(url.trim());
      if (!check.ok) {
        return NextResponse.json({ error: check.error ?? "URL no válida" }, { status: 400 });
      }
      const page = await fetchAndExtractText(check.normalized!);
      extractedText = page.text;
    } else if (file instanceof File) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "El archivo es demasiado grande (máx 5MB)" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdf = await extractTextFromPdf(buffer);
      if (pdf.numPages > MAX_PAGES) {
        return NextResponse.json({ error: `El PDF tiene demasiadas páginas (máx ${MAX_PAGES})` }, { status: 400 });
      }
      if (!pdf.hasText) {
        return NextResponse.json(
          {
            error: "Este PDF parece ser una imagen escaneada — no pudimos leer texto seleccionable.",
            scannedPdf: true,
          },
          { status: 422 }
        );
      }
      extractedText = pdf.text;
    } else {
      return NextResponse.json({ error: "Debes indicar una URL o subir un PDF" }, { status: 400 });
    }

    const productInfo = await extractProductInfoFromText(extractedText);
    if (!productInfo) {
      return NextResponse.json(
        { error: "No pudimos identificar un producto en esta fuente. Prueba con otra URL o PDF, o crea el producto manualmente." },
        { status: 422 }
      );
    }

    return NextResponse.json({ productInfo });
  } catch (error) {
    log.error({ err: error }, "analyze-source error");
    // The source site itself rejected our fetch (bot protection, WAF, etc.)
    // — external and outside our control, not a bug in our code. Give the
    // user an actionable message instead of a generic server-error message.
    const message = error instanceof Error ? error.message : "";
    if (/^HTTP 4\d\d$/.test(message)) {
      return NextResponse.json(
        {
          error: "No pudimos acceder a esa página — puede que el sitio bloquee el acceso automatizado. Prueba con otra URL o sube un PDF en su lugar.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Error al analizar la fuente" }, { status: 500 });
  }
}
