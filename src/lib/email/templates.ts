import { escapeHtml } from "@/lib/sanitize";

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
        ListWise &middot; <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app"}/dashboard" style="color:#6b7280;text-decoration:none;">dashboard</a> &middot; <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app"}/pricing" style="color:#6b7280;text-decoration:none;">planes</a>
      </p>
      <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;text-align:center;">
        Para cancelar la suscripci&#xF3;n a estos correos, responde a este email con el asunto <strong>baja</strong>.
      </p>
    </div>
  </div>
`;

function wrap(body: string): string {
  return BASE.replace("{{BODY}}", body);
}

function ctaButton(label: string, href: string): string {
  const safeHref = /^https?:\/\//.test(href) ? href : "#";
  return `<a href="${safeHref}" style="display:inline-block;margin:20px 0 8px;padding:12px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>`;
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

    ${ctaButton("Ir al dashboard →", `${process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app"}/dashboard`)}
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
    ${ctaButton("Ver mis listings →", "https://listwise.app/dashboard")}
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
    ${ctaButton(isPaid ? "Comprar cr&#xE9;ditos →" : "Ver planes →", "https://listwise.app/pricing")}
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app";
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

export function activationNudgeTemplate({ name }: { name?: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app";
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${greeting} &#x1F440;</h2>
    <p style="color:#374151;line-height:1.6;margin-bottom:8px;">
      Creaste tu cuenta en ListWise hace un par de d&#xED;as pero a&#xFA;n no has generado tu primer listing.
    </p>
    <p style="color:#374151;line-height:1.6;margin-bottom:20px;">
      <strong>Tienes 20 cr&#xE9;ditos esperando.</strong> Aqu&#xED; te explico c&#xF3;mo usarlos en menos de 2 minutos:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">&#x1F4E4;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">1. Sube un CSV con tus productos</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Nombre, categor&#xED;a, precio — lo que tengas. Hay una plantilla lista para descargar.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">&#x1F916;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">2. La IA genera t&#xED;tulo + bullets + descripci&#xF3;n</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Optimizados para Amazon, Etsy, Shopify o donde vendas. En segundos por producto.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:44px;">
          <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">&#x1F4E5;</div>
        </td>
        <td style="padding:10px 0 10px 12px;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">3. Descarga el CSV listo para publicar</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Edita lo que quieras con el Agente IA y exporta con un clic.</p>
        </td>
      </tr>
    </table>
    ${ctaButton("Generar mi primer listing &#x2192;", `${appUrl}/dashboard`)}
    <p style="margin-top:16px;color:#9ca3af;font-size:12px;">
      Si prefieres no recibir este tipo de emails, responde con el asunto <strong>baja</strong>.
    </p>
  `);
}

export function reEngagementTemplate({ name }: { name?: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app";
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${greeting} &#x1F44B;</h2>
    <p style="color:#374151;line-height:1.6;margin-bottom:16px;">
      Llevas unos d&#xED;as sin optimizar listings y quer&#xED;a asegurarme de que todo va bien.
    </p>
    <p style="color:#374151;line-height:1.6;margin-bottom:24px;">
      &#xBF;Tienes productos nuevos para a&#xF1;adir? La IA puede generarte t&#xED;tulo, bullets y descripci&#xF3;n completa en segundos.
    </p>
    <div style="background:#f0f9ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1e40af;">&#x1F4A1; Idea r&#xE1;pida</p>
      <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.5;">
        Sube un CSV con tus productos y deja que ListWise optimice cada descripci&#xF3;n para Amazon, Etsy o tu tienda. Tarda menos de 2 minutos.
      </p>
    </div>
    ${ctaButton("Volver al Dashboard &#x2192;", `${appUrl}/dashboard`)}
    <p style="margin-top:20px;color:#9ca3af;font-size:12px;">
      Si prefieres no recibir este tipo de emails, responde con el asunto <strong>baja</strong>.
    </p>
  `);
}

export function churnPreventionTemplate({ name, plan }: { name?: string; plan: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise.app";
  const greeting = name ? `Hola, ${escapeHtml(name)}` : "Hola";
  const planLabel = plan === "enterprise" ? "Enterprise" : "Pro";
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${greeting}, vemos que has cancelado tu plan ${planLabel}</h2>
    <p style="color:#374151;line-height:1.6;margin-bottom:16px;">
      Lo entendemos. Si hubo algo que no funcionó como esperabas o el precio no encajó, nos encantaría saberlo.
    </p>
    <div style="background:#fef9ec;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#92400e;">&#x1F381; Una oferta para ti</p>
      <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
        Si cambias de idea en los próximos 7 días, escríbenos a <a href="mailto:hola@listwise.app" style="color:#2563eb;">hola@listwise.app</a> con el asunto <strong>vuelvo</strong> y te aplicamos un 30% de descuento en tu próximo mes.
      </p>
    </div>
    <p style="color:#374151;line-height:1.6;margin-bottom:24px;">
      Si prefieres una alternativa más económica, el plan gratuito sigue activo con tus listings guardados.
    </p>
    ${ctaButton("Ver mi cuenta &#x2192;", `${appUrl}/dashboard`)}
    <p style="margin-top:20px;color:#9ca3af;font-size:12px;">
      Si prefieres no recibir este tipo de emails, responde con el asunto <strong>baja</strong>.
    </p>
  `);
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
    ${ctaButton("Ver mis referidos &#x2192;", "https://listwise.app/dashboard/referrals")}
  `);
}
