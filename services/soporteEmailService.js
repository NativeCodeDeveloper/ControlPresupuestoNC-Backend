import { sendBrevoEmail } from './emailUtils.js';
import { buildEmailHtml } from './emailHtmlBuilder.js';

const LOG = '[NEXUS]';

const PRIORIDAD_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
const SLA_LABEL = { 4: '4 horas hábiles', 8: '8 horas hábiles', 24: '24 horas hábiles', 48: '48 horas hábiles' };

function getSlaLabel(horas) {
    return SLA_LABEL[horas] ?? `${horas} horas hábiles`;
}

function formatFecha(date) {
    const d = typeof date === 'string' && !date.includes('T')
        ? new Date(date.replace(' ', 'T') + 'Z')
        : new Date(date);
    return d.toLocaleString('es-CL', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Santiago'
    });
}

// ─── Templates predefinidos (texto editable desde el frontend) ────────────────

export function templateApertura({ ticket }) {
    return {
        subject: `Ticket N° ${ticket.numero_ticket} recibido — ${ticket.asunto}`,
        body: `Estimado(a),

Hemos recibido correctamente su solicitud de soporte.

Ticket N° ${ticket.numero_ticket}
Asunto: ${ticket.asunto}
Prioridad: ${PRIORIDAD_LABEL[ticket.prioridad] ?? ticket.prioridad}
Tiempo estimado de respuesta: ${getSlaLabel(ticket.sla_horas)}
Fecha de creación: ${formatFecha(ticket.creado_en)}

Nuestro equipo se encuentra revisando su caso y nos comunicaremos con usted una vez exista una actualización.

Atentamente,
Equipo de Soporte — Agenda Clínica / NativeCode`
    };
}

export function templateActualizacion({ ticket, nuevoEstado, mensaje }) {
    return {
        subject: `Actualización Ticket N° ${ticket.numero_ticket} — ${ticket.asunto}`,
        body: mensaje || `Estimado(a),

Le informamos que su ticket de soporte ha sido actualizado.

Ticket N° ${ticket.numero_ticket}
Estado actual: ${nuevoEstado}

Continuamos trabajando en su caso. Le notificaremos ante cualquier novedad.

Atentamente,
Equipo de Soporte — Agenda Clínica / NativeCode`
    };
}

export function templateCierre({ ticket, resolucion }) {
    const detalle = [
        resolucion?.causa    ? `Causa: ${resolucion.causa}`           : null,
        resolucion?.accion   ? `Acción realizada: ${resolucion.accion}` : null,
        resolucion?.resultado ? `Resultado: ${resolucion.resultado}`  : null,
        resolucion?.observaciones ? `Observaciones: ${resolucion.observaciones}` : null,
    ].filter(Boolean).join('\n');

    return {
        subject: `Re: Ticket N° ${ticket.numero_ticket} recibido — ${ticket.asunto}`,
        body: `Estimado(a),

Le informamos que su caso de soporte ha sido resuelto y cerrado.

Ticket N° ${ticket.numero_ticket}

${detalle ? `Resolución:\n${detalle}` : 'El caso ha sido resuelto satisfactoriamente.'}

Si requiere asistencia adicional, puede responder directamente a este correo y con gusto revisaremos nuevamente su caso.

Atentamente,
Equipo de Soporte — Agenda Clínica / NativeCode`
    };
}

// ─── HTML wrapper compartido ──────────────────────────────────────────────────

const CONTACT_HTML = `<p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">Ante cualquier consulta, responda directamente a este correo.</p>`;

function buildHtml({ numero_ticket, asunto, bodyText }) {
    return buildEmailHtml({
        eyebrow: 'Soporte Técnico',
        title: asunto,
        subtitle: `Ticket N° ${numero_ticket}`,
        bodyText,
        contactHtml: CONTACT_HTML,
        footerText: 'NativeCode · Agenda Clínica',
    });
}

// ─── Funciones de envío ───────────────────────────────────────────────────────

export async function enviarApertura({ ticket, bodyText }) {
    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) { console.warn(`${LOG} Sin email remitente configurado.`); return { ok: false }; }

    const template = templateApertura({ ticket });
    const texto = bodyText ?? template.body;

    const ok = await sendBrevoEmail({
        senderName: 'Agenda Clínica Soporte',
        senderEmail,
        to: ticket.email_cliente,
        subject: template.subject,
        htmlContent: buildHtml({ numero_ticket: ticket.numero_ticket, asunto: ticket.asunto, bodyText: texto }),
        textContent: texto,
        logPrefix: LOG
    });

    console.log(`${LOG} Apertura ticket ${ticket.numero_ticket} → ${ticket.email_cliente}: ${ok ? 'OK' : 'ERROR'}`);
    return { ok };
}

export async function enviarActualizacion({ ticket, nuevoEstado, bodyText }) {
    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) { console.warn(`${LOG} Sin email remitente configurado.`); return { ok: false }; }

    const template = templateActualizacion({ ticket, nuevoEstado, mensaje: bodyText });
    const texto = bodyText ?? template.body;

    const ok = await sendBrevoEmail({
        senderName: 'Agenda Clínica Soporte',
        senderEmail,
        to: ticket.email_cliente,
        subject: template.subject,
        htmlContent: buildHtml({ numero_ticket: ticket.numero_ticket, asunto: ticket.asunto, bodyText: texto }),
        textContent: texto,
        logPrefix: LOG
    });

    console.log(`${LOG} Actualización ticket ${ticket.numero_ticket}: ${ok ? 'OK' : 'ERROR'}`);
    return { ok };
}

export async function enviarCierre({ ticket, resolucion, bodyText }) {
    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) { console.warn(`${LOG} Sin email remitente configurado.`); return { ok: false }; }

    const template = templateCierre({ ticket, resolucion });
    const texto = bodyText ?? template.body;

    const headers = {};
    if (ticket.email_apertura_message_id) {
        headers['In-Reply-To'] = ticket.email_apertura_message_id;
        headers['References']  = ticket.email_apertura_message_id;
    }

    const ok = await sendBrevoEmail({
        senderName: 'Agenda Clínica Soporte',
        senderEmail,
        to: ticket.email_cliente,
        subject: template.subject,
        htmlContent: buildHtml({ numero_ticket: ticket.numero_ticket, asunto: ticket.asunto, bodyText: texto }),
        textContent: texto,
        logPrefix: LOG
    });

    console.log(`${LOG} Cierre ticket ${ticket.numero_ticket}: ${ok ? 'OK' : 'ERROR'}`);
    return { ok };
}
