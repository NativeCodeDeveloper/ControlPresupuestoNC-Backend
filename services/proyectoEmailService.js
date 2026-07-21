import { sendBrevoEmail } from './emailUtils.js';

const LOG = '[PROYECTO-EMAIL]';

// ─── HTML wrapper — premium, texto plano (sin imágenes), branding NativeCode ──

function buildHtml({ subject, bodyText }) {
    const safeSubject = String(subject || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeBody = String(bodyText || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
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
            <p style="margin:0 0 4px;font-size:15px;font-weight:800;letter-spacing:.02em;color:#111111;">nativecode</p>
            <p style="margin:0 0 22px;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b5cf6;">
              Ingeniería de Software
            </p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#1d1d1f;letter-spacing:-.4px;line-height:1.3;">
              ${safeSubject}
            </h1>
          </td>
        </tr>

        <tr><td style="padding:0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:28px 48px 8px;">
            <p style="margin:0;font-size:14.5px;line-height:1.85;color:#3a3a3c;">${safeBody}</p>
          </td>
        </tr>

        <tr><td style="padding:16px 48px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Contacto -->
        <tr>
          <td style="padding:22px 48px 30px;">
            <p style="margin:0 0 4px;font-size:12.5px;font-weight:600;color:#1d1d1f;">Soporte NativeCode</p>
            <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">
              <a href="mailto:ingenieria.software@nativecode.cl" style="color:#6366f1;text-decoration:none;font-weight:500;">ingenieria.software@nativecode.cl</a><br/>
              +56 9 6609 1038 &nbsp;·&nbsp; Tiempo de respuesta: dentro de 24 horas hábiles
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9fb;border-top:1px solid #e5e5ea;padding:18px 48px;">
            <p style="margin:0;font-size:11.5px;color:#aeaeb2;text-align:center;letter-spacing:.01em;">
              NativeCode SPA &nbsp;·&nbsp; Santiago de Chile &nbsp;·&nbsp; © ${year}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

/**
 * enviarProyectoEmail - Envía un correo relacionado a un proyecto (bienvenida,
 * solicitud de usuarios, finalización, etc). Si se recibe `html`, se envía tal
 * cual (template ya diseñado); si no, se envuelve `body` en el wrapper de
 * marca NativeCode. `to` acepta múltiples destinatarios separados por coma.
 */
export async function enviarProyectoEmail({ to, subject, body, html, attachments = [] }) {
    const recipients = String(to || '').split(',').map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) return { ok: false, error: 'Email destinatario inválido.' };

    const htmlContent = html || buildHtml({ subject, bodyText: body });
    const safeAttachments = (Array.isArray(attachments) ? attachments : [])
        .filter((a) => a?.content && a?.name)
        .slice(0, 5);

    const results = await Promise.all(recipients.map((email) =>
        sendBrevoEmail({
            senderName: 'NativeCode',
            senderEmail: 'contacto@nativecode.cl',
            to: email,
            subject,
            htmlContent,
            textContent: body,
            logPrefix: LOG,
            attachments: safeAttachments,
        })
    ));

    const allOk = results.every(Boolean);
    return allOk ? { ok: true, enviados: recipients.length } : { ok: false, error: 'Hubo un error al enviar uno o más correos.' };
}
