const BASE = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#2563eb;padding:24px 32px;">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ListWise</span>
      <span style="color:#93c5fd;font-size:13px;margin-left:8px;">— IA para listings que venden</span>
    </div>
    <div style="padding:32px;">
      {{BODY}}
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        ListWise &middot; <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise-app.onrender.com"}/dashboard" style="color:#6b7280;text-decoration:none;">dashboard</a> &middot; <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise-app.onrender.com"}/pricing" style="color:#6b7280;text-decoration:none;">planes</a>
      </p>
      <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;text-align:center;">
        Para cancelar la suscripci&#xF3;n a estos correos, responde a este email con el asunto <strong>baja</strong>.
      </p>
    </div>
  </div>
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function wrap(body: string): string {
  return BASE.replace("{{BODY}}", body);
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin:20px 0 8px;padding:12px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>`;
}

export function welcomeEmailTemplate({ firstName }: { firstName: string }): string {
  const name = firstName ? ` ${escapeHtml(firstName)}` : "";
  return wrap(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">&#x1F389; &#xA1;Bienvenido/a${name} a ListWise!</h2>
    <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">Tu cuenta est&#xE1; lista. En menos de 60 segundos puedes tener tu primer listing optimizado con IA.</p>

    <p style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:600;">Empieza as&#xED;:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:18px;">&#x1F4E4;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">Sube tu CSV</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Descarga la plantilla, a&#xF1;ade los nombres de tus productos y sube el archivo.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:18px;">&#x26A1;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">La IA genera todo</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">T&#xED;tulo optimizado, bullets de venta y descripci&#xF3;n para cada producto en segundos.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:18px;">&#x1F916;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">Refina con el Agente</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Usa el Agente de Copywriting para perfeccionar cualquier listing con lenguaje natural.</p>
        </td>
      </tr>
    </table>

    ${ctaButton("Ir al dashboard →", `${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise-app.onrender.com"}/dashboard`)}
    <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">&#xBF;Tienes dudas? Responde directamente a este email.</p>
  `);
}

export function listingReadyTemplate({ count, productNames }: { count: number; productNames?: string[] }): string {
  const plural = count === 1 ? "listing est&#xE1; listo" : `listings est&#xE1;n listos`;
  const preview = productNames && productNames.length > 0
    ? `<p style="margin:16px 0 4px;color:#374151;font-size:13px;font-weight:600;">Productos generados:</p>
       <ul style="margin:0 0 16px;padding-left:20px;color:#6b7280;font-size:13px;">
         ${productNames.slice(0, 5).map(n => `<li style="margin-bottom:4px;">${escapeHtml(n)}</li>`).join("")}
         ${productNames.length > 5 ? `<li style="color:#9ca3af;">...y ${productNames.length - 5} m&#xE1;s</li>` : ""}
       </ul>`
    : "";

  return wrap(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">&#x2705; Tus ${count} ${plural}</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      La IA ha generado t&#xED;tulo, bullets de venta y descripci&#xF3;n optimizada para cada uno de tus productos.
    </p>
    ${preview}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:0 0 16px;">
      <p style="margin:0;color:#166534;font-size:13px;">
        &#x1F4A1; <strong>Siguiente paso:</strong> Usa el Agente de Copywriting para refinar el tono, ajustar keywords o adaptar el listing a un marketplace espec&#xED;fico.
      </p>
    </div>
    ${ctaButton("Ver mis listings →", "https://listwise-app.onrender.com/dashboard")}
  `);
}

export function creditsLowTemplate({ remaining, plan }: { remaining: number; plan: string }): string {
  const isPaid = plan !== "free";
  return wrap(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">&#x26A0;&#xFE0F; Tus cr&#xE9;ditos est&#xE1;n casi agotados</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      Te quedan <strong>${remaining} cr&#xE9;ditos</strong>. Cuando se agoten no podr&#xE1;s usar el Agente ni generar nuevos listings.
    </p>
    ${isPaid
      ? `<p style="color:#6b7280;font-size:14px;">Como usuario ${escapeHtml(plan)}, puedes comprar packs de cr&#xE9;ditos adicionales desde tu dashboard.</p>`
      : `<p style="color:#6b7280;font-size:14px;">Con el plan Pro o Enterprise obtienes cr&#xE9;ditos adicionales y acceso ilimitado al Agente.</p>`
    }
    ${ctaButton(isPaid ? "Comprar cr&#xE9;ditos →" : "Ver planes →", "https://listwise-app.onrender.com/pricing")}
  `);
}

export function leadMagnetTemplate({
  name,
  pdfUrl,
  unsubscribeUrl,
}: {
  name?: string;
  pdfUrl: string;
  unsubscribeUrl: string;
}): string {
  const greeting = name ? `Hola ${escapeHtml(name)},` : "Hola,";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise-app.onrender.com";
  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#f97316;padding:24px 32px;">
    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ListWise</span>
    <span style="color:#fde68a;font-size:13px;margin-left:8px;">&#x2014; Tu gu&#xED;a de descripciones</span>
  </div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">&#x1F4E9; Aqu&#xED; tienes tu gu&#xED;a</h2>
    <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">${greeting} &#xA1;Gracias por suscribirte! Aqu&#xED; est&#xE1; la gu&#xED;a definitiva de descripciones que pediste:</p>

    <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
      <p style="margin:0 0 4px;color:#9a3412;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">TU GU&#xCD;A GRATUITA</p>
      <h3 style="margin:0 0 16px;color:#111827;font-size:17px;font-weight:700;">7 errores que matan tus ventas + la f&#xF3;rmula SEO que Amazon premia</h3>
      <a href="${pdfUrl}" style="display:inline-block;padding:14px 32px;background:#f97316;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">&#x1F4E5; DESCARGAR PDF</a>
    </div>

    <h3 style="margin:0 0 12px;color:#111827;font-size:15px;font-weight:600;">&#xBF;Y ahora qu&#xE9;?</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#fff7ed;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">&#x1F381;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">Prueba ListWise con 20 cr&#xE9;ditos gratis</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Genera tu primer listing optimizado en menos de 60 segundos. Sin tarjeta de cr&#xE9;dito.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#fff7ed;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">&#x1F916;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">Usa el Agente de Copywriting</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">P&#xED;dele que adapte el tono, a&#xF1;ada keywords o traduzca al ingl&#xE9;s &#x2014; con lenguaje natural.</p>
        </td>
      </tr>
    </table>

    <a href="${appUrl}/sign-up" style="display:inline-block;margin:0 0 8px;padding:12px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Empezar gratis &#x2192;</a>
    <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">&#xBF;Tienes dudas? Responde directamente a este email.</p>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
      ListWise &middot; <a href="${appUrl}" style="color:#6b7280;text-decoration:none;">listwise.app</a>
    </p>
    <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;text-align:center;">
      Recibiste este email porque descargaste un recurso gratuito de ListWise.<br>
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Cancelar suscripci&#xF3;n</a>
    </p>
  </div>
</div>`.trim();
}

export function referralRegistrationTemplate({ refereeEmail }: { refereeEmail: string | null }): string {
  const who = refereeEmail ? `<strong>${escapeHtml(refereeEmail)}</strong>` : "alguien";
  return wrap(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">&#x1F389; Tu invitaci&#xF3;n funcion&#xF3;</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      ${who} acaba de registrarse en ListWise usando tu enlace personal. &#xA1;Felicidades!
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;color:#15803d;font-size:14px;font-weight:600;">&#x2705; Ambos hab&#xE9;is recibido +10 cr&#xE9;ditos de regalo</p>
      <p style="margin:6px 0 0;color:#166534;font-size:13px;">Los cr&#xE9;ditos ya est&#xE1;n disponibles en vuestras cuentas.</p>
    </div>
    <p style="margin:0 0 4px;color:#4b5563;font-size:14px;line-height:1.6;">
      Cuando tu invitado contrate un plan de pago, ganar&#xE1;s recompensas adicionales. Sigue compartiendo tu enlace para acumular m&#xE1;s.
    </p>
    ${ctaButton("Ver mis referidos &#x2192;", "https://listwise-app.onrender.com/dashboard/referrals")}
  `);
}
