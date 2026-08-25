import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { log } from "@/lib/logger";
import { analyzeTitle, analyzeBullets, scoreDescription, analyzeSpecificity } from "@/lib/listings/health-score";

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
    const descA = scoreDescription(listing);
    const combinedText = [bullets?.join(" ") ?? "", listing.generatedDescription ?? ""].join(" ");
    const specificity = analyzeSpecificity(combinedText, listing.attributes as Record<string, string> | null);
    const total = Math.max(0, titleA.score + bulletsA.score + descA.score - specificity.penalty);

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
    log.error({ err: error }, "Agent analyze error");
    return NextResponse.json({ error: "Error al analizar" }, { status: 500 });
  }
}
