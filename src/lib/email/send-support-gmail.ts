import nodemailer from "nodemailer";
import { resolve4 } from "node:dns/promises";
import { log } from "@/lib/logger";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

// Dedicated Gmail SMTP path for the support-contact form ONLY — deliberately
// separate from sendEmail() (Resend), which needs a verified sending domain
// that isn't set up yet. Using a Gmail account + App Password sidesteps
// domain/DNS entirely: sends and receives on the same inbox the user already
// controls. Not meant to replace sendEmail() for the app's other email
// features (referrals, cron re-engagement, leads, webhooks).
export async function sendSupportEmailViaGmail({
  subject,
  html,
}: {
  subject: string;
  html: string;
}): Promise<{ success: boolean }> {
  const user = process.env.GMAIL_SUPPORT_USER;
  const appPassword = process.env.GMAIL_SUPPORT_APP_PASSWORD;
  if (!user || !appPassword) {
    log.warn("GMAIL_SUPPORT_USER/GMAIL_SUPPORT_APP_PASSWORD not set — support email skipped");
    return { success: false };
  }

  try {
    // Real production failure: nodemailer resolves BOTH A and AAAA records
    // for the host and picks one AT RANDOM (see its shared/index.js —
    // there's no "prefer IPv4" option, `family` is not something it reads).
    // Render has no outbound IPv6 route, so any AAAA pick fails with
    // ENETUNREACH. Resolving the A record ourselves and connecting to that
    // literal IP skips nodemailer's own dual-family resolution entirely
    // (it only runs that logic for hostnames, not literal IPs) — servername
    // is set explicitly so TLS still validates against the real hostname.
    const [ip] = await resolve4(GMAIL_SMTP_HOST);
    const transporter = nodemailer.createTransport({
      host: ip,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: { user, pass: appPassword },
      tls: { servername: GMAIL_SMTP_HOST },
      // Without these, a blocked outbound SMTP port (common on PaaS hosts —
      // Render, Heroku, etc. often restrict 465/587 to curb spam) hangs the
      // request indefinitely instead of failing with a diagnosable error.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transporter.sendMail({ from: user, to: user, subject, html });
    return { success: true };
  } catch (err) {
    log.error({ err }, "Gmail SMTP send failed");
    return { success: false };
  }
}
