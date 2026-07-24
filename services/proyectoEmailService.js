import { sendBrevoEmail } from './emailUtils.js';
import { buildEmailHtml } from './emailHtmlBuilder.js';

const LOG = '[PROYECTO-EMAIL]';

const CONTACT_HTML = `<p style="margin:0 0 4px;font-size:12.5px;font-weight:600;color:#1d1d1f;">Soporte NativeCode</p>
<p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">
  <a href="mailto:ingenieria.software@nativecode.cl" style="color:#6366f1;text-decoration:none;font-weight:500;">ingenieria.software@nativecode.cl</a><br/>
  +56 9 6609 1038 &nbsp;·&nbsp; Tiempo de respuesta: dentro de 24 horas hábiles
</p>`;

// ─── HTML wrapper — premium, texto plano (sin imágenes), branding NativeCode ──

function buildHtml({ subject, bodyText }) {
    return buildEmailHtml({
        eyebrow: 'Ingeniería de Software',
        title: subject,
        bodyText,
        contactHtml: CONTACT_HTML,
    });
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
