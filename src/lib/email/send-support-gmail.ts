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

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword },
    // Without these, a blocked outbound SMTP port (common on PaaS hosts —
    // Render, Heroku, etc. often restrict 465/587 to curb spam) hangs the
    // request indefinitely instead of failing with a diagnosable error.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    await transporter.sendMail({ from: user, to: user, subject, html });
    return { success: true };
  } catch (err) {
    log.error({ err }, "Gmail SMTP send failed");
    return { success: false };
  }
}
