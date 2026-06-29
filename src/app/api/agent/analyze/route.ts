import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

// Rule-based analysis — no AI call, no credit charge
function analyzeTitle(title: string | null): { score: number; notes: string[] } {
  if (!title?.trim()) return { score: 0, notes: ["sin título generado"] };
  const len = title.length;
  let score = 0;
  const notes: string[] = [];

  if (len >= 60 && len <= 200) { score += 15; notes.push(`${len} chars — longitud ideal`); }
  else if (len < 60) { score += 5; notes.push(`${len} chars (mín 60)`); }
  else { score += 8; notes.push(`${len} chars (máx 200)`); }

  if (/[®©™%]/.test(title)) notes.push("contiene símbolos prohibidos");
  else { score += 5; notes.push("sin símbolos prohibidos"); }

  const firstSegment = title.split(/[|·\-–—]/)[0]?.trim() ?? "";
  if (firstSegment.length <= 45) { score += 5; notes.push("keyword al inicio"); }

  return { score: Math.min(25, score), notes };
}

function analyzeBullets(bullets: string[] | null): { score: number; notes: string[] } {
  if (!bullets?.length) return { score: 0, notes: ["sin bullets generados"] };
  const count = bullets.length;
  let score = 0;
  const notes: string[] = [];

  if (count >= 4 && count <= 7) { score += 15; notes.push(`${count} bullets`); }
  else { score += 5; notes.push(`${count} bullets (ideal: 4-7)`); }

  const formatted = bullets.filter((b) => /^[A-ZÁÉÍÓÚÑ\s]{2,}:\s/.test(b));
  if (formatted.length === count) { score += 20; notes.push("todos con CONCEPTO: ✓"); }
  else if (formatted.length > 0) { score += 10; notes.push(`${count - formatted.length} sin formato CONCEPTO:`); }
  else notes.push("ninguno sigue el formato CONCEPTO: descripción");

  // Detect strongest (most data-rich) bullet not in position 0
  const dataRe = /\b\d+\s*(?:%|g\b|kg\b|ml\b|l\b|cm\b|mm\b|m\b|h\b|min\b|€|\$|w\b|mah\b|db\b)/i;
  const richIdx = bullets.findIndex((b) => dataRe.test(b));
  if (richIdx > 0) notes.push(`💡 bullet ${richIdx + 1} tiene más datos — muévelo al primero`);

  return { score: Math.min(35, score), notes };
}

function analyzeDescription(description: string | null): { score: number; notes: string[] } {
  if (!description?.trim()) return { score: 0, notes: ["sin descripción generada"] };
  const words = description.trim().split(/\s+/).length;
  let score = 0;
  const notes: string[] = [];

  if (words >= 120 && words <= 280) { score += 20; notes.push(`${words} palabras`); }
  else if (words < 120) { score += 8; notes.push(`${words} palabras (mín 120)`); }
  else { score += 12; notes.push(`${words} palabras (máx 280)`); }

  const isFormalTone = /^esta |^el diseño|^la composición|^este producto/i.test(description.trim()) && !/imagina|piensa en/i.test(description);
  if (/imagina|piensa en/i.test(description)) { score += 10; notes.push("Future Pacing ✓"); }
  else if (isFormalTone) { score += 10; notes.push("Estructura formal ✓"); }
  else notes.push("falta Future Pacing");

  if (/el resultado/i.test(description)) { score += 10; notes.push("cierre 'El resultado' ✓"); }
  else notes.push("falta cierre 'El resultado'");

  return { score: Math.min(40, score), notes };
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get("listingId");
    if (!listingId) return NextResponse.json({ error: "listingId requerido" }, { status: 400 });

    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, listingId), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const bullets = Array.isArray(listing.generatedBullets)
      ? (listing.generatedBullets as string[])
      : null;

    const titleA = analyzeTitle(listing.generatedTitle);
    const bulletsA = analyzeBullets(bullets);
    const descA = analyzeDescription(listing.generatedDescription);
    const total = titleA.score + bulletsA.score + descA.score;

    const attrStr = JSON.stringify(listing.attributes ?? {}).toLowerCase();
    const missingAttrs: string[] = [];
    if (!/(material|composición|algodón|poliéster|tejido|fibra|cotton|polyester|silk|seda|lana|wool|nylon|lycra)/.test(attrStr))
      missingAttrs.push("composición del material");
    if (!/(color|colour|negro|blanco|azul|rojo|verde|gris|beige|rosa|amarillo|naranja|morado)/.test(attrStr))
      missingAttrs.push("color disponible");
    if (!/(talla|size|medida|dimensión|peso|weight|\bcm\b|\bmm\b|\bml\b|\bl\b|\bxl\b|\bxs\b|\bs\b|\bm\b|alto|ancho|largo)/.test(attrStr))
      missingAttrs.push("talla o medidas");
    if (!/(lavado|cuidado|care|wash|mantenimiento|lavar|planchar|secar)/.test(attrStr))
      missingAttrs.push("instrucciones de cuidado");

    const scoreEmoji = total >= 85 ? "🏆" : total >= 70 ? "✅" : total >= 50 ? "⚠️" : "🔴";
    const titleIcon = titleA.score >= 20 ? "✅" : "⚠️";
    const bulletsIcon = bulletsA.score >= 28 ? "✅" : "⚠️";
    const descIcon = descA.score >= 32 ? "✅" : "⚠️";

    const areas = [
      { name: "el título", ratio: titleA.score / 25, missing: 25 - titleA.score },
      { name: "los bullets", ratio: bulletsA.score / 35, missing: 35 - bulletsA.score },
      { name: "la descripción", ratio: descA.score / 40, missing: 40 - descA.score },
    ].sort((a, b) => a.ratio - b.ratio);

    const worst = areas[0];
    const suggestion =
      worst.missing > 0
        ? `Te recomiendo empezar por ${worst.name} — puedo sumar hasta ${worst.missing} pts. ¿Lo optimizamos ahora?`
        : `El listing está bien optimizado. ¿Quieres ajustar algún aspecto en concreto?`;

    const missingNote = missingAttrs.length > 0
      ? `\n💡 Para mejores resultados añade a la ficha: ${missingAttrs.join(", ")}.`
      : "";

    const message = [
      `He analizado "${listing.productName}". Puntuación actual: ${total}/100 ${scoreEmoji}\n`,
      `${titleIcon} Título (${titleA.score}/25): ${titleA.notes.join(" · ")}`,
      `${bulletsIcon} Bullets (${bulletsA.score}/35): ${bulletsA.notes.join(" · ")}`,
      `${descIcon} Descripción (${descA.score}/40): ${descA.notes.join(" · ")}`,
      `\n${suggestion}`,
      missingNote,
    ].join("\n");

    return NextResponse.json({
      message,
      scores: { title: titleA.score, bullets: bulletsA.score, description: descA.score, total },
      current: {
        title: listing.generatedTitle ?? null,
        bullets: bullets ?? null,
        description: listing.generatedDescription ?? null,
      },
      missingAttrs,
    });
  } catch (error) {
    console.error("❌ [Analyze] Error:", error);
    return NextResponse.json({ error: "Error al analizar" }, { status: 500 });
  }
}
