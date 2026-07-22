import * as Actualizaciones from '../model/ActualizacionesModel.js';
import { sendBrevoEmail } from '../services/emailUtils.js';

const SENDER_NAME  = process.env.EMAIL_SENDER_NAME   || 'NativeCode';
const SENDER_EMAIL = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;

function buildHtml(titulo, mensaje, nombreCliente) {
    const safe = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeTitulo = safe(titulo);
    const safeNombre = safe(nombreCliente);
    const safeMensaje = safe(mensaje).replace(/\n/g, '<br>');
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
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#1d1d1f;letter-spacing:-.4px;line-height:1.3;">
              ${safeTitulo}
            </h1>
          </td>
        </tr>

        <tr><td style="padding:0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:28px 48px 8px;">
            ${nombreCliente ? `<p style="margin:0 0 18px;font-size:14.5px;color:#3a3a3c;">Estimado/a <strong>${safeNombre}</strong>,</p>` : ''}
            <p style="margin:0;font-size:14.5px;line-height:1.85;color:#3a3a3c;">${safeMensaje}</p>
          </td>
        </tr>

        <tr><td style="padding:16px 48px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="border-top:1px solid #e5e5ea;"></td></tr></table>
        </td></tr>

        <!-- Contacto -->
        <tr>
          <td style="padding:22px 48px 30px;">
            <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">
              Ante cualquier consulta, responde a este correo o contáctanos directamente.
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

async function enviarADestinatarios(actualizacion) {
    if (!SENDER_EMAIL) return { enviados: 0, errores: 0, sinSender: true };
    const destinatarios = typeof actualizacion.destinatarios === 'string'
        ? JSON.parse(actualizacion.destinatarios || '[]')
        : (actualizacion.destinatarios ?? []);

    let enviados = 0, errores = 0;
    for (const dest of destinatarios) {
        if (!dest.email) { errores++; continue; }
        const ok = await sendBrevoEmail({
            senderName:  SENDER_NAME,
            senderEmail: SENDER_EMAIL,
            to:          dest.email,
            subject:     actualizacion.titulo,
            htmlContent: buildHtml(actualizacion.titulo, actualizacion.mensaje, dest.nombre),
            textContent: `${actualizacion.titulo}\n\n${actualizacion.mensaje}`,
            logPrefix:   '[ACTUALIZACIÓN]',
        });
        ok ? enviados++ : errores++;
    }
    return { enviados, errores };
}

export default class ActualizacionesController {

    // ─── Estados ──────────────────────────────────────────────────────────────

    static async listarEstados(_req, res) {
        try { res.json(await Actualizaciones.getEstados() ?? []); }
        catch (e) { res.status(500).json({ message: 'Error al obtener estados' }); }
    }

    static async crearEstado(req, res) {
        try {
            const { nombre, color_hex } = req.body;
            if (!nombre?.trim()) return res.status(400).json({ message: 'Nombre requerido' });
            await Actualizaciones.createEstado({ nombre: nombre.trim(), color_hex: color_hex ?? '#6b7280' });
            res.status(201).json({ ok: true, estados: await Actualizaciones.getEstados() });
        } catch (e) { res.status(500).json({ message: 'Error al crear estado' }); }
    }

    static async eliminarEstado(req, res) {
        try {
            await Actualizaciones.deleteEstado(req.params.id);
            res.json({ ok: true, estados: await Actualizaciones.getEstados() });
        } catch (e) { res.status(500).json({ message: 'Error al eliminar estado' }); }
    }

    // ─── Actualizaciones CRUD ─────────────────────────────────────────────────

    static async listar(req, res) {
        try { res.json(await Actualizaciones.getActualizaciones(req.query) ?? []); }
        catch (e) { res.status(500).json({ message: 'Error al obtener historial' }); }
    }

    static async obtener(req, res) {
        try {
            const act = await Actualizaciones.getActualizacion(req.params.id);
            if (!act) return res.status(404).json({ message: 'No encontrada' });
            res.json(act);
        } catch (e) { res.status(500).json({ message: 'Error al obtener actualización' }); }
    }

    static async crear(req, res) {
        try {
            const { titulo, mensaje, destinatarios, id_estado, prioridad, modo, id_socio } = req.body;
            if (!titulo?.trim())  return res.status(400).json({ message: 'Título requerido' });
            if (!mensaje?.trim()) return res.status(400).json({ message: 'Mensaje requerido' });

            const id = await Actualizaciones.createActualizacion({
                titulo, mensaje, destinatarios: destinatarios ?? [],
                id_socio, id_estado, prioridad, modo,
            });
            const act = await Actualizaciones.getActualizacion(id);
            res.status(201).json({ ok: true, actualizacion: act });
        } catch (e) {
            console.error('[Actualizaciones.crear]', e.message);
            res.status(500).json({ message: 'Error al crear actualización' });
        }
    }

    static async actualizar(req, res) {
        try {
            const { id_estado, titulo, mensaje, prioridad, modo, destinatarios } = req.body;
            await Actualizaciones.updateActualizacion(req.params.id, {
                id_estado, titulo, mensaje, prioridad, modo, destinatarios,
            });
            const act = await Actualizaciones.getActualizacion(req.params.id);
            res.json({ ok: true, actualizacion: act });
        } catch (e) {
            console.error('[Actualizaciones.actualizar]', e.message);
            res.status(500).json({ message: 'Error al actualizar' });
        }
    }

    static async eliminar(req, res) {
        try {
            await Actualizaciones.deleteActualizacion(req.params.id);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ message: 'Error al eliminar' }); }
    }

    static async notificar(req, res) {
        try {
            if (!SENDER_EMAIL) return res.status(500).json({ message: 'Email remitente no configurado' });
            const act = await Actualizaciones.getActualizacion(req.params.id);
            if (!act) return res.status(404).json({ message: 'No encontrada' });

            const { enviados, errores } = await enviarADestinatarios(act);
            await Actualizaciones.updateActualizacion(req.params.id, {
                total_enviados: enviados,
                total_errores:  errores,
            });
            res.json({ ok: true, enviados, errores });
        } catch (e) {
            console.error('[Actualizaciones.notificar]', e.message);
            res.status(500).json({ message: 'Error al notificar' });
        }
    }

    // Legado: enviar = crear + notificar en un paso (mantener para compat)
    static async enviar(req, res) {
        try {
            const { titulo, mensaje, destinatarios, id_estado, prioridad, modo, id_socio } = req.body;
            if (!titulo?.trim())   return res.status(400).json({ message: 'Título requerido' });
            if (!mensaje?.trim())  return res.status(400).json({ message: 'Mensaje requerido' });
            if (!Array.isArray(destinatarios) || !destinatarios.length)
                return res.status(400).json({ message: 'Selecciona al menos un destinatario' });
            if (!SENDER_EMAIL) return res.status(500).json({ message: 'Email remitente no configurado' });

            const actData = { titulo, mensaje, destinatarios, id_socio, id_estado, prioridad, modo };
            const { enviados, errores } = await enviarADestinatarios(actData);

            const id = await Actualizaciones.createActualizacion({
                ...actData, total_enviados: enviados, total_errores: errores,
            });
            await Actualizaciones.updateActualizacion(id, { total_enviados: enviados, total_errores: errores });

            res.json({ ok: true, enviados, errores });
        } catch (e) {
            console.error('[Actualizaciones.enviar]', e.message);
            res.status(500).json({ message: 'Error al enviar actualización' });
        }
    }
}
