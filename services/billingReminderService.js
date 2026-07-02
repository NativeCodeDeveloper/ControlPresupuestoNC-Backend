import DataBase from '../config/Database.js';
import { formatearFecha, formatearMonto, sendBrevoEmail } from './emailUtils.js';

/**
 * SISTEMA DE RECORDATORIOS DE COBRO - NativeCode Finance
 *
 * Envía correos al equipo NativeCode cuando un proyecto está por vencer o vencido.
 * 5 etapas de escalación:
 *   +5 días  → Preparación: preparar y enviar cobro
 *   +1 día   → Urgente: enviar cobro hoy
 *    0 días  → Vencimiento: hoy vence el cobro
 *   -3 días  → Seguimiento: sin confirmación de pago
 *   -7 días  → Escalación urgente
 *
 * Cada columna rem_* guarda el valor de fecha_proximo_pago cuando se envió,
 * así se auto-resetea cuando el ciclo avanza al siguiente mes.
 */

const LOG = '[BILLING]';

const STAGES = [
    {
        col: 'rem_aviso',
        diff: 5,
        etiqueta: 'PREPARACIÓN',
        asunto: 'Cobro por vencer — 5 días',
        titulo: 'Vence en 5 días',
        mensaje: 'Tienes 5 días para preparar y enviar el cobro a este cliente.',
        accion: 'Prepara la factura o comprobante y envíala con anticipación.'
    },
    {
        col: 'rem_urgente',
        diff: 1,
        etiqueta: 'URGENTE',
        asunto: 'Cobro vence mañana',
        titulo: 'El cobro vence mañana',
        mensaje: 'Si aún no has enviado la factura, hazlo hoy.',
        accion: 'Envía el cobro hoy para darle tiempo al cliente de realizar el pago.'
    },
    {
        col: 'rem_vencimiento',
        diff: 0,
        etiqueta: 'VENCE HOY',
        asunto: 'Hoy vence el cobro',
        titulo: 'Hoy es el día de cobro',
        mensaje: 'El período de facturación vence hoy.',
        accion: 'Confirma que el pago fue recibido o contacta al cliente directamente.'
    },
    {
        col: 'rem_seguimiento',
        diff: -3,
        etiqueta: 'SEGUIMIENTO',
        asunto: 'Cobro pendiente — 3 días sin confirmar',
        titulo: 'Sin confirmación de pago',
        mensaje: 'Han pasado 3 días desde el vencimiento sin registrar el pago.',
        accion: 'Contacta al cliente y solicita confirmación del pago pendiente.'
    },
    {
        col: 'rem_escalacion',
        diff: -7,
        etiqueta: 'ESCALACIÓN',
        asunto: 'Cobro vencido — 7 días',
        titulo: 'Pago vencido hace 7 días',
        mensaje: 'El cobro lleva 7 días vencido sin confirmación.',
        accion: 'Requiere atención inmediata. Contacta al cliente con carácter urgente.'
    }
];

function buildEmailHtml({ proyecto, stage }) {
    const montoStr = formatearMonto(proyecto.monto_acordado);
    const fechaStr = formatearFecha(proyecto.fecha_proximo_pago);

    const F = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:${F};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;padding:44px 16px 56px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="max-width:660px;width:100%;background:#ffffff;border-radius:16px;
                  overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.07);">

      <!-- Accent line -->
      <tr><td style="background:#6366f1;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

      <!-- Header -->
      <tr><td style="padding:36px 52px 28px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.1em;
                  text-transform:uppercase;color:#8e8e93;">${stage.etiqueta}</p>
        <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#1d1d1f;
                   letter-spacing:-.5px;line-height:1.2;">${stage.titulo}</h1>
        <p style="margin:0;font-size:15px;color:#6e6e73;line-height:1.6;">${stage.mensaje}</p>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:0 52px;"><div style="height:1px;background:#e5e5ea;"></div></td></tr>

      <!-- Data rows -->
      <tr><td style="padding:24px 52px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:14px;color:#8e8e93;">Cliente</td>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:14px;color:#1d1d1f;font-weight:500;text-align:right;">${proyecto.nombre_cliente || '—'}</td>
          </tr>
          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:14px;color:#8e8e93;">Proyecto</td>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:14px;color:#1d1d1f;font-weight:500;text-align:right;">
              ${proyecto.nombre || '—'} <span style="color:#8e8e93;font-weight:400;font-size:13px;">(${proyecto.codigo_interno || ''})</span>
            </td>
          </tr>
          <tr>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:14px;color:#8e8e93;">Monto</td>
            <td style="padding:11px 0;border-bottom:1px solid #f2f2f7;font-size:15px;color:#1d1d1f;font-weight:700;text-align:right;">${montoStr}</td>
          </tr>
          <tr>
            <td style="padding:11px 0;font-size:14px;color:#8e8e93;">Vencimiento</td>
            <td style="padding:11px 0;font-size:14px;color:#1d1d1f;font-weight:500;text-align:right;">${fechaStr}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Action box -->
      <tr><td style="padding:0 52px 36px;">
        <div style="background:#f5f5f7;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#3a3a3c;line-height:1.65;">
            <strong>Acción:</strong> ${stage.accion}
          </p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9f9fb;border-top:1px solid #e5e5ea;padding:18px 52px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#aeaeb2;letter-spacing:.01em;">
          NativeCode Finance &nbsp;·&nbsp; Recordatorio automático
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function marcarEnviado(conexion, idProyecto, col, fechaProximoPago) {
    try {
        await conexion.ejecutarQuery(
            `UPDATE proyectos SET ${col} = ? WHERE id_proyecto = ?`,
            [fechaProximoPago, idProyecto]
        );
    } catch (error) {
        console.error(`${LOG} Error marcando ${col} para proyecto ${idProyecto}:`, error.message);
    }
}

async function obtenerProyectosParaRecordar(conexion) {
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
    console.log(`${LOG} ========================================`);
    console.log(`${LOG} Iniciando recordatorios de cobro...`);
    console.log(`${LOG} Fecha:`, new Date().toLocaleString('es-CL'));

    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) {
        console.warn(`${LOG} BILLING_REMINDER_TO no configurado. Saltando.`);
        return { enviados: 0, errores: 0 };
    }

    const conexion = DataBase.getInstance();
    let enviados = 0;
    let errores = 0;

    try {
        const proyectos = await obtenerProyectosParaRecordar(conexion);

        if (!Array.isArray(proyectos) || proyectos.length === 0) {
            console.log(`${LOG} Sin proyectos que requieran recordatorio hoy.`);
            console.log(`${LOG} ========================================`);
            return { enviados: 0, errores: 0 };
        }

        console.log(`${LOG} ${proyectos.length} proyecto(s) a procesar`);

        for (const proyecto of proyectos) {
            const diff = Math.round(
                (new Date(proyecto.fecha_proximo_pago) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)
            );

            const stage = STAGES.find(s => s.diff === diff);
            if (!stage) continue;

            if (proyecto[stage.col] === proyecto.fecha_proximo_pago) {
                console.log(`${LOG} ${stage.etiqueta} ya enviado para ${proyecto.codigo_interno}`);
                continue;
            }

            console.log(`${LOG} Enviando ${stage.etiqueta} → ${proyecto.nombre_cliente} (${proyecto.codigo_interno})`);

            const ok = await sendBrevoEmail({
                senderName: 'NativeCode Finance',
                senderEmail,
                to: senderEmail,
                subject: `${stage.asunto} — ${proyecto.nombre_cliente || proyecto.nombre}`,
                htmlContent: buildEmailHtml({ proyecto, stage }),
                textContent: `${stage.etiqueta}: ${stage.mensaje}\n\nCliente: ${proyecto.nombre_cliente}\nProyecto: ${proyecto.nombre} (${proyecto.codigo_interno})\nMonto: ${formatearMonto(proyecto.monto_acordado)}\nVencimiento: ${proyecto.fecha_proximo_pago}\n\nAcción: ${stage.accion}`,
                logPrefix: LOG
            });

            if (ok) {
                await marcarEnviado(conexion, proyecto.id_proyecto, stage.col, proyecto.fecha_proximo_pago);
                enviados++;
            } else {
                errores++;
            }
        }
    } catch (error) {
        console.error(`${LOG} Error general:`, error.message);
        errores++;
    }

    console.log(`${LOG} Finalizado. Enviados: ${enviados}, Errores: ${errores}`);
    console.log(`${LOG} ========================================`);
    return { enviados, errores };
}
