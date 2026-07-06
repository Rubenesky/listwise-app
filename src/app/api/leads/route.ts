import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { sendEmail } from "@/lib/email/send";
import { leadMagnetTemplate } from "@/lib/email/templates";
import { ratelimitLeads } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";
import { log } from "@/lib/logger";

const leadsBodySchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(100).optional(),
  marketplace: z.string().max(50).optional(),
  pageUrl: z.string().url().max(500).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

function hashIp(ip: string): string {
  if (!process.env.IP_HASH_SALT) log.warn("IP_HASH_SALT not set — hashes reversible");
  return createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "lw-salt-default"))
    .digest("hex")
    .slice(0, 16);
}

export async function POST(req: Request) {
  try {
    // Rate limit by IP (3 submissions per 24h per IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: rlOk } = await ratelimitLeads.limit(hashIp(ip));
    if (!rlOk) {
      return NextResponse.json({ error: "Demasiados intentos. Inténtalo mañana." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = leadsBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }
    const { email, name, marketplace, pageUrl, utmSource, utmMedium, utmCampaign } = parsed.data;

    const safeEmail = email.toLowerCase().trim();
    const now = Math.floor(Date.now() / 1000);

    // Deduplicate — if already exists, still send the PDF but don't insert again
    const existing = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.email, safeEmail))
      .limit(1);

    let leadId: string;
    if (existing.length > 0) {
      leadId = existing[0].id;
    } else {
      leadId = uuidv4();
      await db.insert(schema.leads).values({
        id: leadId,
        email: safeEmail,
        name: name ? String(name).slice(0, 100) : null,
        marketplace: marketplace ? String(marketplace).slice(0, 50) : null,
        pageUrl: pageUrl ? String(pageUrl).slice(0, 500) : null,
        ipHash: hashIp(ip),
        utmSource: utmSource ? String(utmSource).slice(0, 100) : null,
        utmMedium: utmMedium ? String(utmMedium).slice(0, 100) : null,
        utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 100) : null,
        unsubscribed: 0,
        createdAt: now,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app";
    const pdfUrl = process.env.LEAD_MAGNET_PDF_URL ?? "";
    const unsubscribeUrl = `${appUrl}/api/leads/unsubscribe?id=${leadId}`;

    // Send PDF email to lead
    await sendEmail({
      to: safeEmail,
      subject: "📩 Aquí tienes tu guía de descripciones",
      html: leadMagnetTemplate({ name: name ? String(name) : undefined, pdfUrl, unsubscribeUrl }),
    });

    // Notify admin
    if (!process.env.ADMIN_EMAIL) log.warn("ADMIN_EMAIL not set, using fallback");
    const adminEmail = process.env.ADMIN_EMAIL ?? "dcrubben25@gmail.com";
    const safeName = escapeHtml(name ? String(name).slice(0, 100) : "—");
    const safeMarketplace = escapeHtml(marketplace ? String(marketplace).slice(0, 50) : "—");
    await sendEmail({
      to: adminEmail,
      subject: `🎯 Nuevo lead magnet: ${escapeHtml(safeEmail)}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px;"><strong>Lead magnet</strong><br>Email: <strong>${escapeHtml(safeEmail)}</strong><br>Nombre: ${safeName}<br>Marketplace: ${safeMarketplace}<br>Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error({ err }, "Leads route error");
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
