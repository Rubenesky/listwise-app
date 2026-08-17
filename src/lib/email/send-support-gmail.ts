import nodemailer from "nodemailer";
import { log } from "@/lib/logger";

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

  // nodemailer's TS types don't declare `family`, but it's forwarded to
  // Node's underlying socket connection at runtime. Building the options as
  // a variable (instead of an inline literal) avoids TypeScript's excess-
  // property check on the unfamiliar field while staying otherwise typed.
  const transportOptions = {
    service: "gmail",
    auth: { user, pass: appPassword },
    // Without these, a blocked outbound SMTP port (common on PaaS hosts —
    // Render, Heroku, etc. often restrict 465/587 to curb spam) hangs the
    // request indefinitely instead of failing with a diagnosable error.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Real failure hit in production: Node resolved smtp.gmail.com to an
    // IPv6 address and got ENETUNREACH — Render has no outbound IPv6 route.
    // Forcing IPv4 avoids that resolution path entirely.
    family: 4,
  };
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    await transporter.sendMail({ from: user, to: user, subject, html });
    return { success: true };
  } catch (err) {
    log.error({ err }, "Gmail SMTP send failed");
    return { success: false };
  }
}
