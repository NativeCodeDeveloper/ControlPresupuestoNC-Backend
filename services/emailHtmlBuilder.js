// ─── Wrapper HTML compartido — "Apple card" premium, branding NativeCode ──────
// Usado por: proyectoEmailService, ActualizacionesController, SynapseController
// (Cockpit) y soporteEmailService. Mantiene un único estilo visual consistente
// en todos los correos salvo Bienvenida/Finalización (tienen su propio diseño).

export function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @param {object} opts
 * @param {string} [opts.eyebrow]      Etiqueta pequeña sobre el título (ej: "Ingeniería de Software")
 * @param {string} opts.title          Título principal (h1)
 * @param {string} [opts.subtitle]     Línea pequeña bajo el título (ej: "Ticket N° 123")
 * @param {string} [opts.greetingHtml] HTML ya seguro para el saludo (ej: "Estimado/a <strong>Juan</strong>,")
 * @param {string} [opts.bodyText]     Cuerpo en texto plano (se escapa y \n -> <br>)
 * @param {string} [opts.bodyHtml]     Cuerpo ya en HTML seguro (tiene prioridad sobre bodyText)
 * @param {string} [opts.contactHtml]  Bloque de contacto en HTML seguro (si no se pasa, usa uno genérico)
 * @param {string} [opts.footerText='NativeCode SPA · Santiago de Chile']
 */
export function buildEmailHtml({
    eyebrow,
    title,
    subtitle,
    greetingHtml,
    bodyText,
    bodyHtml,
    contactHtml,
    footerText = 'NativeCode SPA · Santiago de Chile',
}) {
    const safeTitle = escapeHtml(title);
    const safeSubtitle = subtitle ? escapeHtml(subtitle) : '';
    const safeBody = bodyHtml || escapeHtml(bodyText).replace(/\n/g, '<br>');
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f2f2f7;padding:44px 16px 56px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                    box-shadow:0 1px 4px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.07);overflow:hidden;">

        <!-- Header / marca -->
        <tr>
          <td style="padding:36px 48px 24px;">
            <img src="https://nativecode-finance.agendaclinicas.cl/logo_template_negro.png" alt="NativeCode" width="170" style="display:block;max-width:170px;height:auto;margin:0 0 18px;">
            ${eyebrow ? `<p style="margin:0 0 22px;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b5cf6;">${escapeHtml(eyebrow)}</p>` : ''}
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#1d1d1f;letter-spacing:-.4px;line-height:1.3;">
              ${safeTitle}
            </h1>
            ${safeSubtitle ? `<p style="margin:8px 0 0;font-size:13px;color:#8e8e93;">${safeSubtitle}</p>` : ''}
          </td>
        </tr>

        <tr><td style="padding:0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:28px 48px 8px;">
            ${greetingHtml ? `<p style="margin:0 0 18px;font-size:14.5px;color:#3a3a3c;">${greetingHtml}</p>` : ''}
            <p style="margin:0;font-size:14.5px;line-height:1.85;color:#3a3a3c;">${safeBody}</p>
          </td>
        </tr>

        <tr><td style="padding:16px 48px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Contacto -->
        <tr>
          <td style="padding:22px 48px 30px;">
            ${contactHtml || `<p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">Ante cualquier consulta, responde a este correo o contáctanos directamente.</p>`}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9fb;border-top:1px solid #e5e5ea;padding:18px 48px;">
            <p style="margin:0;font-size:11.5px;color:#aeaeb2;text-align:center;letter-spacing:.01em;">
              ${escapeHtml(footerText)} &nbsp;·&nbsp; © ${year}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
