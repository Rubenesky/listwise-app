import { Resend } from "resend";
import { log } from "@/lib/logger";

const FROM = process.env.FROM_EMAIL ?? "ListWise <hola@listwise.app>";

export async function sendEmail({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  // Overrides the default sender for this call only — e.g. Resend's
  // no-verification-needed sandbox address (onboarding@resend.dev) for a
  // feature that can't wait on domain verification.
  from?: string;
}): Promise<{ success: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not set — email skipped");
    return { success: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { error } = await resend.emails.send({ from: from ?? FROM, to, subject, html });
    if (error) {
      log.error({ resendError: error }, "Resend API error");
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    log.error({ err }, "sendEmail failed");
    return { success: false };
  }
}
