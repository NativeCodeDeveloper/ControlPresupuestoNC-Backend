import DataBase from '../config/Database.js';
import { formatearFecha, formatearMonto, sendBrevoEmail } from './emailUtils.js';

/**
 * SISTEMA DE RECORDATORIOS AL CLIENTE - NativeCode Finance
 *
 * Envía correos directamente al cliente cuando su suscripción está por vencer o vencida.
 * 4 etapas progresivas:
 *   +2 días → Aviso previo de renovación
 *    0 días → Hoy vence la suscripción
 *   -1 día  → Pago pendiente
 *   -3 días → Aviso de suspensión del servicio
 *
 * Habilitado por defecto. Para deshabilitar: EMAIL_CLIENTE_ENABLED=false en .env
 *
 * Cada columna rem_cliente_* guarda el valor de fecha_proximo_pago cuando se envió,
 * así se auto-resetea cuando el ciclo avanza al siguiente mes.
 */

const LOG = '[CLIENT-REM]';

const STAGES = [
    {
        col: 'rem_cliente_previo',
        diff: 2,
        etiqueta: 'RECORDATORIO',
        asunto: 'Tu suscripción vence en 2 días',
        titulo: 'Tu pago vence pronto',
        mensaje: 'Tu suscripción mensual está por renovarse. Asegúrate de tener el pago listo para evitar interrupciones en tu servicio.',
        esSuspension: false,
        mostrarFooterPago: false
    },
    {
        col: 'rem_cliente_vencimiento',
        diff: 0,
        etiqueta: 'VENCE HOY',
        asunto: 'Tu suscripción vence hoy',
        titulo: 'Hoy vence tu suscripción',
        mensaje: 'El período de facturación de tu servicio vence hoy. Realiza el pago para continuar sin interrupciones.',
        esSuspension: false,
        mostrarFooterPago: true
    },
    {
        col: 'rem_cliente_postuno',
        diff: -1,
        etiqueta: 'PAGO PENDIENTE',
        asunto: 'Tienes un pago pendiente',
        titulo: 'Pago no registrado',
        mensaje: 'No hemos registrado el pago de tu suscripción. Tu servicio podría interrumpirse si no se regulariza pronto.',
        esSuspension: false,
        mostrarFooterPago: true
    },
    {
        col: 'rem_cliente_postres',
        diff: -3,
        etiqueta: 'AVISO DE SUSPENSIÓN',
        asunto: 'Tu servicio NativeCode será suspendido',
        titulo: 'Aviso de suspensión',
        mensaje: 'Han pasado 3 días desde el vencimiento sin recibir tu pago. Para evitar la suspensión de tu servicio, por favor regulariza tu situación a la brevedad.',
        esSuspension: true,
        mostrarFooterPago: true
    }
];

function buildClientEmailHtml({ proyecto, stage }) {
    const montoStr = formatearMonto(proyecto.monto_acordado);
    const fechaStr = formatearFecha(proyecto.fecha_proximo_pago);

    const suspensionBlock = stage.esSuspension ? `
      <tr><td style="padding:0 40px 20px;">
        <div style="background:#fff1f0;border:1px solid #ffccc7;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#cf1322;line-height:1.6;font-weight:500;">
            Tu servicio será suspendido si no regularizas el pago. Contáctanos para coordinar.
          </p>
        </div>
      </td></tr>` : '';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

      <tr><td style="padding:32px 40px 8px;text-align:center;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#1d1d1f;letter-spacing:0.5px;">NativeCode</p>
      </td></tr>

      <tr><td style="padding:20px 40px 28px;">
        <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#86868b;letter-spacing:1px;text-transform:uppercase;">${stage.etiqueta}</p>
        <h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;color:#1d1d1f;line-height:1.2;">${stage.titulo}</h1>
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#6e6e73;line-height:1.6;">Hola, ${proyecto.nombre_cliente}. ${stage.mensaje}</p>
      </td></tr>

      <tr><td style="padding:0 40px;"><div style="height:1px;background:#f2f2f7;"></div></td></tr>

      <tr><td style="padding:24px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#86868b;">Servicio</td>
            <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#1d1d1f;font-weight:500;text-align:right;">${proyecto.nombre || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#86868b;">Monto</td>
            <td style="padding:10px 0;border-bottom:1px solid #f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#1d1d1f;font-weight:600;text-align:right;">${montoStr}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#86868b;">Fecha de pago</td>
            <td style="padding:10px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#1d1d1f;font-weight:500;text-align:right;">${fechaStr}</td>
          </tr>
        </table>
      </td></tr>

      ${suspensionBlock}

      ${stage.mostrarFooterPago ? `
      <tr><td style="padding:0 40px 20px;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#86868b;line-height:1.5;text-align:center;">
          Si ya realizaste el pago, por favor ignora este mensaje.<br>Tu servicio se actualizará automáticamente cuando registremos tu abono.
        </p>
      </td></tr>` : ''}

      <tr><td style="border-top:1px solid #f2f2f7;padding:24px 40px;text-align:center;">
        <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#3a3a3c;">¿Tienes alguna consulta? Contáctanos por WhatsApp o responde este correo.</p>
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#86868b;">NativeCode · Este es un mensaje automático</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildTextContent({ proyecto, stage }) {
    return `${stage.etiqueta} — NativeCode\n\nHola, ${proyecto.nombre_cliente}.\n\n${stage.mensaje}\n\nServicio: ${proyecto.nombre}\nMonto: ${formatearMonto(proyecto.monto_acordado)}\nFecha de pago: ${proyecto.fecha_proximo_pago}\n\n${stage.esSuspension ? 'Tu servicio será suspendido si no regularizas el pago.\n\n' : ''}¿Tienes consultas? Responde este correo o contáctanos por WhatsApp.\n\nNativeCode`;
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

async function obtenerProyectosParaNotificarCliente(conexion) {
    const diffs = STAGES.map(s => s.diff);
    const placeholders = diffs.map(() => '?').join(', ');

    return conexion.ejecutarQuery(
        `SELECT id_proyecto, nombre, nombre_cliente, email_cliente,
                monto_acordado, fecha_proximo_pago, ciclo_facturacion,
                rem_cliente_previo, rem_cliente_vencimiento, rem_cliente_postuno, rem_cliente_postres
         FROM proyectos
         WHERE activo = 1
           AND ciclo_facturacion != 'Unico'
           AND fecha_proximo_pago IS NOT NULL
           AND email_cliente IS NOT NULL
           AND email_cliente != ''
           AND DATEDIFF(fecha_proximo_pago, CURDATE()) IN (${placeholders})`,
        diffs
    );
}

export async function ejecutarRecordatoriosCliente() {
    const habilitado = String(process.env.EMAIL_CLIENTE_ENABLED ?? 'true').toLowerCase();
    if (habilitado === 'false') {
        console.log(`${LOG} Recordatorios al cliente deshabilitados (EMAIL_CLIENTE_ENABLED=false).`);
        return { enviados: 0, errores: 0, omitidos: 0 };
    }

    console.log(`${LOG} ========================================`);
    console.log(`${LOG} Iniciando recordatorios al cliente...`);
    console.log(`${LOG} Fecha:`, new Date().toLocaleString('es-CL'));

    const senderEmail = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;
    if (!senderEmail) {
        console.warn(`${LOG} BILLING_REMINDER_TO no configurado. Saltando.`);
        return { enviados: 0, errores: 0, omitidos: 0 };
    }

    const conexion = DataBase.getInstance();
    let enviados = 0;
    let errores = 0;
    let omitidos = 0;

    try {
        const proyectos = await obtenerProyectosParaNotificarCliente(conexion);

        if (!Array.isArray(proyectos) || proyectos.length === 0) {
            console.log(`${LOG} Sin proyectos que requieran notificación al cliente hoy.`);
            console.log(`${LOG} ========================================`);
            return { enviados: 0, errores: 0, omitidos: 0 };
        }

        console.log(`${LOG} ${proyectos.length} proyecto(s) a procesar`);

        for (const proyecto of proyectos) {
            const diff = Math.round(
                (new Date(proyecto.fecha_proximo_pago) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)
            );

            const stage = STAGES.find(s => s.diff === diff);
            if (!stage) continue;

            if (proyecto[stage.col] === proyecto.fecha_proximo_pago) {
                console.log(`${LOG} ${stage.etiqueta} ya enviado a ${proyecto.email_cliente} para ciclo actual`);
                omitidos++;
                continue;
            }

            console.log(`${LOG} Enviando ${stage.etiqueta} → ${proyecto.nombre_cliente} <${proyecto.email_cliente}>`);

            const ok = await sendBrevoEmail({
                senderName: 'NativeCode',
                senderEmail,
                to: proyecto.email_cliente,
                subject: `${stage.asunto} — ${proyecto.nombre}`,
                htmlContent: buildClientEmailHtml({ proyecto, stage }),
                textContent: buildTextContent({ proyecto, stage }),
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

    console.log(`${LOG} Finalizado. Enviados: ${enviados}, Omitidos: ${omitidos}, Errores: ${errores}`);
    console.log(`${LOG} ========================================`);
    return { enviados, errores, omitidos };
}
