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

  if (/imagina|piensa en/i.test(description)) { score += 10; notes.push("Future Pacing ✓"); }
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

    const message = [
      `He analizado "${listing.productName}". Puntuación actual: ${total}/100 ${scoreEmoji}\n`,
      `${titleIcon} Título (${titleA.score}/25): ${titleA.notes.join(" · ")}`,
      `${bulletsIcon} Bullets (${bulletsA.score}/35): ${bulletsA.notes.join(" · ")}`,
      `${descIcon} Descripción (${descA.score}/40): ${descA.notes.join(" · ")}`,
      `\n${suggestion}`,
    ].join("\n");

    return NextResponse.json({
      message,
      scores: { title: titleA.score, bullets: bulletsA.score, description: descA.score, total },
    });
  } catch (error) {
    console.error("❌ [Analyze] Error:", error);
    return NextResponse.json({ error: "Error al analizar" }, { status: 500 });
  }
}
