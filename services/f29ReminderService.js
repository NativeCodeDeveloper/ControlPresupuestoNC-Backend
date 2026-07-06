import { sendBrevoEmail } from './emailUtils.js';
import { calcularF29 } from './financeService.js';
import DataBase from '../config/Database.js';

const LOG = '[F29]';

// Días antes del 20 en que se envía el recordatorio
const DIAS_AVISO = [5, 1];

// Evita envíos duplicados si el cron corre varias veces en el mismo día
const _yaEnviado = new Set();

function getNombreMes(mes) {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes - 1];
}

function buildEmailHtml({ mesDeclaracion, añoDeclaracion, vencimiento, totalF29, diasRestantes }) {
    const urgencia = diasRestantes <= 1 ? '#ef4444' : '#f59e0b';
    const label = diasRestantes <= 1 ? 'VENCE HOY' : `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`;
    const montoStr = totalF29 != null
        ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalF29)
        : 'Ver proyección en sistema';

    return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f0f0f;border-radius:12px;overflow:hidden;">
        <div style="background:#7c3aed;padding:20px 24px;">
            <p style="margin:0;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.7;">NativeCode Finance</p>
            <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Formulario 29 — SII</h1>
        </div>
        <div style="padding:24px;">
            <div style="background:${urgencia}18;border:1px solid ${urgencia}40;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
                <p style="margin:0;color:${urgencia};font-weight:700;font-size:14px;">${label} — Vence el ${vencimiento}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="color:#888;font-size:12px;padding:6px 0;">Período declarado</td>
                    <td style="color:#fff;font-size:13px;font-weight:600;text-align:right;">${getNombreMes(mesDeclaracion)} ${añoDeclaracion}</td>
                </tr>
                <tr>
                    <td style="color:#888;font-size:12px;padding:6px 0;">Fecha límite</td>
                    <td style="color:#fff;font-size:13px;font-weight:600;text-align:right;">20 de ${getNombreMes(mesDeclaracion === 12 ? 1 : mesDeclaracion + 1)} ${mesDeclaracion === 12 ? añoDeclaracion + 1 : añoDeclaracion}</td>
                </tr>
                <tr style="border-top:1px solid #222;">
                    <td style="color:#a78bfa;font-size:13px;font-weight:700;padding:10px 0 4px;">Total estimado F29</td>
                    <td style="color:#a78bfa;font-size:15px;font-weight:800;text-align:right;padding:10px 0 4px;">${montoStr}</td>
                </tr>
            </table>
            <p style="margin:20px 0 0;color:#666;font-size:11px;">Ingresa a la sección Flujo de Caja para ver el detalle completo de la proyección.</p>
        </div>
    </div>`;
}

export async function ejecutarRecordatorioF29() {
    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) {
        console.log(`${LOG} Sin email configurado, omitiendo.`);
        return { enviados: 0, errores: 0 };
    }

    const hoy = new Date();
    const diaHoy = hoy.getDate();

    // Calcular cuántos días faltan para el próximo día 20
    let vencimiento, mesDeclaracion, añoDeclaracion;
    if (diaHoy < 20) {
        // Faltan (20 - diaHoy) días para el 20 de este mes
        vencimiento = new Date(hoy.getFullYear(), hoy.getMonth(), 20);
        // La declaración es del mes anterior
        const mesAnterior = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
        const añoAnterior = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
        mesDeclaracion = mesAnterior;
        añoDeclaracion = añoAnterior;
    } else {
        // Ya pasó el 20 de este mes → próximo es el 20 del mes siguiente
        vencimiento = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 20);
        mesDeclaracion = hoy.getMonth() + 1; // mes actual (0-indexed +1)
        añoDeclaracion = hoy.getFullYear();
    }

    const diasRestantes = Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24));

    if (!DIAS_AVISO.includes(diasRestantes)) {
        return { enviados: 0, errores: 0 };
    }

    const dedupeKey = `${hoy.toISOString().slice(0, 10)}-${mesDeclaracion}-${añoDeclaracion}-${diasRestantes}`;
    if (_yaEnviado.has(dedupeKey)) {
        console.log(`${LOG} Aviso ya enviado hoy (${dedupeKey}), omitiendo.`);
        return { enviados: 0, errores: 0 };
    }

    console.log(`${LOG} ============ F29 REMINDER ============`);
    console.log(`${LOG} Faltan ${diasRestantes} días — enviando aviso a ${senderEmail}`);

    // Calcular monto estimado del F29
    let totalF29 = null;
    try {
        const f29 = await calcularF29({ mes: mesDeclaracion, year: añoDeclaracion });
        totalF29 = f29?.total_f29 ?? null;
    } catch (_) {}

    const vencimientoStr = `${vencimiento.getDate().toString().padStart(2,'0')}/${(vencimiento.getMonth()+1).toString().padStart(2,'0')}/${vencimiento.getFullYear()}`;

    const subject = diasRestantes <= 1
        ? `F29 SII vence mañana — ${getNombreMes(mesDeclaracion)} ${añoDeclaracion}`
        : `F29 SII — ${diasRestantes} días para declarar ${getNombreMes(mesDeclaracion)} ${añoDeclaracion}`;

    let enviados = 0, errores = 0;
    try {
        const ok = await sendBrevoEmail({
            senderName: 'NativeCode Finance',
            senderEmail,
            to: senderEmail,
            subject,
            htmlContent: buildEmailHtml({ mesDeclaracion, añoDeclaracion, vencimiento: vencimientoStr, totalF29, diasRestantes }),
            textContent: `F29 SII — Faltan ${diasRestantes} días. Período: ${getNombreMes(mesDeclaracion)} ${añoDeclaracion}. Vence: ${vencimientoStr}. Total estimado: ${totalF29 ?? 'Ver sistema'}.`,
            logPrefix: LOG
        });
        if (ok) {
            enviados++;
            _yaEnviado.add(dedupeKey);
            try {
                const tituloNotif = diasRestantes <= 1
                    ? `F29 SII — vence mañana`
                    : `F29 SII — ${diasRestantes} días para declarar`;
                const db = DataBase.getInstance();
                const yaNotificado = await db.ejecutarQuery(
                    `SELECT id FROM notificaciones_inapp WHERE tipo = 'f29' AND DATE(creado_en) = CURDATE() LIMIT 1`,
                    []
                );
                if (!yaNotificado?.length) {
                    await db.ejecutarQuery(
                        `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, ?, 'f29')`,
                        [
                            tituloNotif,
                            `Período ${getNombreMes(mesDeclaracion)} ${añoDeclaracion}. Vence el ${vencimientoStr}`,
                            vencimiento.toISOString().slice(0, 10)
                        ]
                    );
                }
            } catch (_) {}
        } else {
            errores++;
        }
    } catch (err) {
        console.error(`${LOG} Error enviando email:`, err?.message);
        errores++;
    }

    console.log(`${LOG} Finalizado. Enviados: ${enviados}, Errores: ${errores}`);
    console.log(`${LOG} =====================================`);
    return { enviados, errores };
}
