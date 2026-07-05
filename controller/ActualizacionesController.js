import * as Actualizaciones from '../model/ActualizacionesModel.js';
import { sendBrevoEmail } from '../services/emailUtils.js';

const SENDER_NAME  = process.env.EMAIL_SENDER_NAME  || 'NativeCode Finance';
const SENDER_EMAIL = process.env.EMAIL_SENDER_EMAIL  || 'no-reply@nativecode.cl';

function buildHtml(titulo, mensaje, nombreCliente) {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:system-ui,sans-serif;background:#0f172a;margin:0;padding:0}
  .wrap{max-width:580px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155}
  .head{background:linear-gradient(135deg,#0ea5e9,#38bdf8);padding:28px 32px}
  .head h1{color:#fff;font-size:20px;margin:0;font-weight:700}
  .head p{color:#e0f2fe;font-size:12px;margin:4px 0 0}
  .body{padding:28px 32px;color:#e2e8f0}
  .body h2{color:#38bdf8;font-size:16px;margin:0 0 14px;border-bottom:1px solid #334155;padding-bottom:10px}
  .msg{background:#0f172a;border-left:3px solid #38bdf8;border-radius:6px;padding:14px 16px;font-size:14px;white-space:pre-wrap;line-height:1.6}
  .footer{padding:20px 32px;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b}
</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>Actualización del Sistema</h1>
      <p>NativeCode Finance — Aviso a clientes</p>
    </div>
    <div class="body">
      ${nombreCliente ? `<p style="margin:0 0 16px;font-size:14px">Estimado/a <strong>${nombreCliente}</strong>,</p>` : ''}
      <h2>${titulo}</h2>
      <div class="msg">${mensaje.replace(/\n/g, '<br>')}</div>
      <p style="margin:18px 0 0;font-size:13px;color:#94a3b8">
        Ante cualquier consulta, responde a este correo o contáctanos directamente.
      </p>
    </div>
    <div class="footer">NativeCode Finance · Sistema de gestión</div>
  </div>
</body>
</html>`;
}

export default class ActualizacionesController {

    // ─── Estados ──────────────────────────────────────────────────────────────

    static async listarEstados(_req, res) {
        try {
            const estados = await Actualizaciones.getEstados();
            res.json(estados ?? []);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener estados' });
        }
    }

    static async crearEstado(req, res) {
        try {
            const { nombre, color_hex } = req.body;
            if (!nombre?.trim()) return res.status(400).json({ message: 'Nombre requerido' });
            await Actualizaciones.createEstado({ nombre: nombre.trim(), color_hex: color_hex ?? '#6b7280' });
            const estados = await Actualizaciones.getEstados();
            res.status(201).json({ ok: true, estados });
        } catch (e) {
            res.status(500).json({ message: 'Error al crear estado' });
        }
    }

    static async eliminarEstado(req, res) {
        try {
            await Actualizaciones.deleteEstado(req.params.id);
            const estados = await Actualizaciones.getEstados();
            res.json({ ok: true, estados });
        } catch (e) {
            res.status(500).json({ message: 'Error al eliminar estado' });
        }
    }

    // ─── Actualizaciones ──────────────────────────────────────────────────────

    static async listar(req, res) {
        try {
            const data = await Actualizaciones.getActualizaciones(req.query);
            res.json(data ?? []);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener historial' });
        }
    }

    static async enviar(req, res) {
        try {
            const { titulo, mensaje, destinatarios, id_estado, prioridad, modo } = req.body;
            if (!titulo?.trim())   return res.status(400).json({ message: 'Título requerido' });
            if (!mensaje?.trim())  return res.status(400).json({ message: 'Mensaje requerido' });
            if (!Array.isArray(destinatarios) || !destinatarios.length)
                return res.status(400).json({ message: 'Selecciona al menos un destinatario' });

            let enviados = 0, errores = 0;

            for (const dest of destinatarios) {
                if (!dest.email) { errores++; continue; }
                const ok = await sendBrevoEmail({
                    senderName:  SENDER_NAME,
                    senderEmail: SENDER_EMAIL,
                    to:          dest.email,
                    subject:     `[NativeCode Finance] ${titulo}`,
                    htmlContent: buildHtml(titulo, mensaje, dest.nombre),
                    textContent: `${titulo}\n\n${mensaje}`,
                    logPrefix:   '[ACTUALIZACIÓN]',
                });
                ok ? enviados++ : errores++;
            }

            await Actualizaciones.createActualizacion({
                titulo, mensaje, destinatarios,
                total_enviados: enviados,
                total_errores:  errores,
                id_socio:  req.body.id_socio ?? null,
                id_estado: id_estado ? Number(id_estado) : null,
                prioridad: prioridad ?? 'media',
                modo:      modo ?? 'masivo',
            });

            res.json({ ok: true, enviados, errores });
        } catch (e) {
            console.error('[ActualizacionesController.enviar]', e.message);
            res.status(500).json({ message: 'Error al enviar actualización' });
        }
    }
}
