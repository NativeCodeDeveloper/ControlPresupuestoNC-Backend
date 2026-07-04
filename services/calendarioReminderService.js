import webpush from 'web-push';
import { getRecordatoriosPendientes, marcarRecordatorioEnviado } from '../model/CalendarioModel.js';
import { sendBrevoEmail } from './emailUtils.js';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:desarrollo.native.code@gmail.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

function formatFecha(fecha) {
    return new Date(fecha).toLocaleString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
    });
}

function buildReminderHtml({ titulo, descripcion, fecha_inicio, minutos_antes }) {
    const etiquetas = { 30: '30 minutos', 60: '1 hora', 360: '6 horas', 1440: 'un día' };
    const cuando = etiquetas[minutos_antes] || `${minutos_antes} minutos`;
    const F = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 0;">
<tr><td align="center">
<table width="100%" style="max-width:660px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#6366f1;height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:48px 52px 0;${F}">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Recordatorio</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#111827;">
      Tienes un evento en ${cuando}
    </h1>
    <div style="background:#f9fafb;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111827;">${titulo}</p>
      ${descripcion ? `<p style="margin:0;font-size:14px;color:#6b7280;">${descripcion}</p>` : ''}
      <p style="margin:12px 0 0;font-size:13px;color:#6366f1;font-weight:500;">${formatFecha(fecha_inicio)}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 52px 48px;${F}">
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      NativeCode Finance · Recordatorio automático · © ${new Date().getFullYear()}
    </p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

async function getPushSubscriptions() {
    try {
        return await db().ejecutarQuery(`SELECT * FROM push_subscriptions`, []);
    } catch { return []; }
}

async function sendPushNotification(titulo, body) {
    const subs = await getPushSubscriptions();
    const payload = JSON.stringify({ titulo, body, icon: '/logonuevoblanco.png', url: '/calendario' });
    await Promise.allSettled(
        subs.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
            ).catch(async (err) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db().ejecutarQuery(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
                }
            })
        )
    );
}

async function createInappNotification({ id_evento, titulo, descripcion, fecha_inicio }) {
    try {
        await db().ejecutarQuery(
            `INSERT INTO notificaciones_inapp (id_evento, titulo, descripcion, fecha_evento) VALUES (?, ?, ?, ?)`,
            [id_evento, titulo, descripcion || null, fecha_inicio]
        );
    } catch {}
}

let corriendo = false;

export async function ejecutarRecordatoriosCalendario() {
    if (corriendo) return;
    corriendo = true;
    try {
        const pendientes = await getRecordatoriosPendientes();
        if (!pendientes.length) return;

        const teamEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;

        for (const r of pendientes) {
            try {
                if (r.tipo === 'email' && teamEmail) {
                    await sendBrevoEmail({
                        senderName:  'NativeCode Finance',
                        senderEmail: teamEmail,
                        to:          teamEmail,
                        subject:     `Recordatorio: ${r.titulo}`,
                        htmlContent: buildReminderHtml(r),
                        logPrefix:   '[CALENDARIO]',
                    });
                }

                if (r.tipo === 'inapp') {
                    await createInappNotification(r);
                    await sendPushNotification(
                        r.titulo,
                        `Tu evento comienza ${
                            r.minutos_antes === 1440 ? 'mañana' :
                            r.minutos_antes === 360  ? 'en 6 horas' :
                            r.minutos_antes === 60   ? 'en 1 hora' : 'en 30 minutos'
                        }`
                    );
                }

                await marcarRecordatorioEnviado(r.id);
            } catch (e) {
                console.error('[CALENDARIO REMINDER] Error recordatorio id', r.id, e.message);
            }
        }
    } finally {
        corriendo = false;
    }
}
