import { Resend } from "resend";
import { log } from "@/lib/logger";

const FROM = process.env.FROM_EMAIL ?? "ListWise <hola@listwise.app>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not set — email skipped");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) log.error({ resendError: error }, "Resend API error");
  } catch (err) {
    log.error({ err }, "sendEmail failed");
  }
}
