import DataBase from '../config/Database.js';

/**
 * SISTEMA DE RECORDATORIOS DE COBRO - NativeCode Finance
 *
 * Envía correos al equipo NativeCode cuando un proyecto está por vencer o vencido.
 * 5 etapas de escalación:
 *   -5 días  → Preparación: preparar y enviar cobro
 *   -1 día   → Urgente: enviar cobro hoy
 *    0 días  → Vencimiento: hoy vence el cobro
 *   +3 días  → Seguimiento: sin confirmación de pago
 *   +7 días  → Escalación urgente
 *
 * Cada columna rem_* guarda el valor de fecha_proximo_pago cuando se envió,
 * así se auto-resetea cuando el ciclo avanza al siguiente mes.
 */

const STAGES = [
    {
        col: 'rem_aviso',
        diff: 5,
        asunto: '📅 Cobro por vencer en 5 días',
        etiqueta: 'PREPARACIÓN',
        color: '#3b82f6',
        mensaje: 'Tienes 5 días para preparar y enviar el cobro a este cliente.',
        accion: 'Prepara la factura o comprobante y envíala al cliente.'
    },
    {
        col: 'rem_urgente',
        diff: 1,
        asunto: '⚠️ Cobro vence mañana',
        etiqueta: 'URGENTE',
        color: '#f59e0b',
        mensaje: 'El cobro vence mañana. Si no has enviado la factura, hazlo hoy.',
        accion: 'Envía el cobro hoy para darle tiempo al cliente de pagar.'
    },
    {
        col: 'rem_vencimiento',
        diff: 0,
        asunto: '🔔 Hoy vence el cobro',
        etiqueta: 'VENCE HOY',
        color: '#f97316',
        mensaje: 'El período de facturación vence hoy.',
        accion: 'Confirma que el pago fue recibido o contacta al cliente.'
    },
    {
        col: 'rem_seguimiento',
        diff: -3,
        asunto: '🔴 Cobro sin confirmar — 3 días',
        etiqueta: 'SEGUIMIENTO',
        color: '#ef4444',
        mensaje: 'Han pasado 3 días desde el vencimiento sin confirmar el pago.',
        accion: 'Contacta al cliente y solicita confirmación del pago.'
    },
    {
        col: 'rem_escalacion',
        diff: -7,
        asunto: '🚨 URGENTE — Cobro vencido 7 días',
        etiqueta: 'ESCALACIÓN',
        color: '#dc2626',
        mensaje: 'El cobro lleva 7 días vencido sin confirmación de pago.',
        accion: 'Requiere atención inmediata. Contacta al cliente con urgencia.'
    }
];

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monto || 0);
}

function buildEmailHtml({ proyecto, stage }) {
    const montoStr = formatearMonto(proyecto.monto_acordado);
    const fechaStr = formatearFecha(proyecto.fecha_proximo_pago);

    return `
<div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: ${stage.color}; padding: 28px 24px; text-align: center;">
    <p style="color: rgba(255,255,255,0.85); margin: 0 0 6px 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">${stage.etiqueta}</p>
    <h1 style="color: white; margin: 0; font-size: 22px;">${stage.asunto}</h1>
  </div>

  <div style="padding: 28px 24px; background: #ffffff;">
    <p style="font-size: 15px; color: #374151; margin: 0 0 20px 0;">${stage.mensaje}</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 0 0 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Cliente</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #111827;">${proyecto.nombre_cliente || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Proyecto</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #111827;">${proyecto.nombre || '—'} <span style="color:#9ca3af; font-size:12px;">(${proyecto.codigo_interno || ''})</span></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Monto</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #111827;">${montoStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Fecha vencimiento</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${fechaStr}</td>
        </tr>
      </table>
    </div>

    <div style="background: #fef3c7; border-left: 4px solid ${stage.color}; padding: 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;"><b>Acción requerida:</b> ${stage.accion}</p>
    </div>
  </div>

  <div style="background: #f3f4f6; padding: 16px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">NativeCode Finance · Recordatorio automático</p>
  </div>
</div>`;
}

async function enviarCorreoCobro(proyecto, stage) {
    const { BREVO_API_KEY } = process.env;
    const destinatario = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;

    if (!BREVO_API_KEY) {
        console.warn('[BILLING] BREVO_API_KEY no configurada. Correo no enviado.');
        return false;
    }
    if (!destinatario) {
        console.warn('[BILLING] BILLING_REMINDER_TO no configurado. Correo no enviado.');
        return false;
    }

    const payload = {
        sender: { name: 'NativeCode Finance', email: destinatario },
        to: [{ email: destinatario }],
        subject: `${stage.asunto} — ${proyecto.nombre_cliente || proyecto.nombre}`,
        htmlContent: buildEmailHtml({ proyecto, stage }),
        textContent: `${stage.etiqueta}: ${stage.mensaje}\n\nCliente: ${proyecto.nombre_cliente}\nProyecto: ${proyecto.nombre} (${proyecto.codigo_interno})\nMonto: ${formatearMonto(proyecto.monto_acordado)}\nVencimiento: ${proyecto.fecha_proximo_pago}\n\nAcción: ${stage.accion}`
    };

    try {
        const resp = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        }, Number(process.env.EMAIL_TIMEOUT_MS || 15000));

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            console.error(`[BILLING] Brevo error ${resp.status}:`, errText);
            return false;
        }

        console.log(`[BILLING] Correo "${stage.etiqueta}" enviado para proyecto ${proyecto.codigo_interno} — ${proyecto.nombre_cliente}`);
        return true;
    } catch (error) {
        console.error('[BILLING] Error enviando correo:', error.message);
        return false;
    }
}

async function marcarEnviado(conexion, idProyecto, col, fechaProximoPago) {
    try {
        await conexion.ejecutarQuery(
            `UPDATE proyectos SET ${col} = ? WHERE id_proyecto = ?`,
            [fechaProximoPago, idProyecto]
        );
    } catch (error) {
        console.error(`[BILLING] Error marcando ${col} para proyecto ${idProyecto}:`, error.message);
    }
}

async function obtenerProyectosParaRecordar(conexion) {
    // DATEDIFF(fecha_proximo_pago, CURDATE()):
    //   positivo → días que faltan
    //   0 → vence hoy
    //   negativo → días que lleva vencido
    const diffs = STAGES.map(s => s.diff);
    const placeholders = diffs.map(() => '?').join(', ');

    return conexion.ejecutarQuery(
        `SELECT id_proyecto, codigo_interno, nombre, nombre_cliente,
                monto_acordado, fecha_proximo_pago, ciclo_facturacion,
                rem_aviso, rem_urgente, rem_vencimiento, rem_seguimiento, rem_escalacion
         FROM proyectos
         WHERE activo = 1
           AND ciclo_facturacion != 'Unico'
           AND fecha_proximo_pago IS NOT NULL
           AND DATEDIFF(fecha_proximo_pago, CURDATE()) IN (${placeholders})`,
        diffs
    );
}

export async function ejecutarRecordatoriosCobro() {
    console.log('[BILLING] ========================================');
    console.log('[BILLING] Iniciando recordatorios de cobro...');
    console.log('[BILLING] Fecha:', new Date().toLocaleString('es-CL'));

    const conexion = DataBase.getInstance();
    let enviados = 0;
    let errores = 0;

    try {
        const proyectos = await obtenerProyectosParaRecordar(conexion);

        if (!Array.isArray(proyectos) || proyectos.length === 0) {
            console.log('[BILLING] Sin proyectos que requieran recordatorio hoy.');
            console.log('[BILLING] ========================================');
            return { enviados: 0, errores: 0 };
        }

        console.log(`[BILLING] ${proyectos.length} proyecto(s) a procesar`);

        for (const proyecto of proyectos) {
            const diff = Math.round(
                (new Date(proyecto.fecha_proximo_pago) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)
            );

            const stage = STAGES.find(s => s.diff === diff);
            if (!stage) continue;

            // Ya fue enviado para este ciclo de facturación
            if (proyecto[stage.col] === proyecto.fecha_proximo_pago) {
                console.log(`[BILLING] ${stage.etiqueta} ya enviado para ${proyecto.codigo_interno}`);
                continue;
            }

            console.log(`[BILLING] Enviando ${stage.etiqueta} → ${proyecto.nombre_cliente} (${proyecto.codigo_interno})`);
            const ok = await enviarCorreoCobro(proyecto, stage);

            if (ok) {
                await marcarEnviado(conexion, proyecto.id_proyecto, stage.col, proyecto.fecha_proximo_pago);
                enviados++;
            } else {
                errores++;
            }
        }
    } catch (error) {
        console.error('[BILLING] Error general:', error.message);
        errores++;
    }

    console.log(`[BILLING] Finalizado. Enviados: ${enviados}, Errores: ${errores}`);
    console.log('[BILLING] ========================================');
    return { enviados, errores };
}
