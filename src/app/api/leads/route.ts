import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const safeEmail = escapeHtml(email);
    const adminEmail = process.env.ADMIN_EMAIL ?? "dcrubben25@gmail.com";
    await sendEmail({
      to: adminEmail,
      subject: `🎯 Nuevo lead en ListWise: ${safeEmail}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px;">Un nuevo visitante introdujo su email en el hero de la landing:</p><p style="font-size:18px;font-weight:bold;">${safeEmail}</p><p style="color:#6b7280;font-size:13px;">Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
