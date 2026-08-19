import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email/send";
import { ratelimitSupportContact } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";
import { log } from "@/lib/logger";

// Gmail SMTP was tried first (see git history) but Render blocks outbound
// SMTP ports at the network level (ETIMEDOUT on every real attempt) — no
// code fix is possible for that. Resend's sandbox sender needs no domain
// verification and goes over HTTPS, which isn't blocked.
const SUPPORT_FROM = "ListWise <onboarding@resend.dev>";
const SUPPORT_INBOX = "dcrubben25@gmail.com";

const bodySchema = z.object({
  message: z.string().trim().min(10, "El mensaje es demasiado corto.").max(2000),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { success: withinLimit } = await ratelimitSupportContact.limit(userId);
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Has enviado demasiados mensajes. Inténtalo de nuevo mañana." },
        { status: 429 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Mensaje inválido." }, { status: 400 });
    }

    const user = await currentUser();
    const fromName = user?.fullName || user?.username || "Usuario ListWise";
    const fromEmail = user?.primaryEmailAddress?.emailAddress ?? "sin email";

    const result = await sendEmail({
      from: SUPPORT_FROM,
      to: SUPPORT_INBOX,
      subject: `[Soporte ListWise] ${fromName}`,
      html: `
        <p><strong>De:</strong> ${escapeHtml(fromName)} (${escapeHtml(fromEmail)})</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br>")}</p>
      `,
    });

    if (!result.success) {
      // sendEmail() swallows the underlying Resend error (logged server-side)
      // so it never throws — check its result explicitly, otherwise a failed
      // send would silently report "sent" to the user while the message
      // never arrives.
      log.error({ userId }, "Support contact email failed to send");
      return NextResponse.json(
        { error: "No se pudo enviar el mensaje. Escríbenos directamente si el problema persiste." },
        { status: 502 }
      );
    }

    log.info({ userId }, "Mensaje de soporte enviado");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "support/contact error");
    return NextResponse.json({ error: "No se pudo enviar el mensaje. Inténtalo de nuevo." }, { status: 500 });
  }
}
