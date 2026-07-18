import * as Synapse from '../model/Synapse.js';
import ConfiguracionFinanciera from '../model/ConfiguracionFinanciera.js';
import { sendBrevoEmail } from '../services/emailUtils.js';
import { emitUpdate } from '../config/socket.js';
import { sendPushToAll } from '../services/pushService.js';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

const err = (res, e, status = 500) => {
    console.error('[SYNAPSE]', e?.message || e);
    res.status(status).json({ error: e?.message || 'Error interno del servidor' });
};

export default class SynapseController {

    // ── Estados ────────────────────────────────────────────────────────────────

    static async getEstados(req, res) {
        try {
            const data = await Synapse.getEstados();
            res.json(data);
        } catch (e) { err(res, e); }
    }

    static async createEstado(req, res) {
        try {
            const { nombre, color_hex, es_final, orden } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            const result = await Synapse.createEstado({ nombre, color_hex, es_final, orden });
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async updateEstado(req, res) {
        try {
            await Synapse.updateEstado(req.params.id, req.body);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async deleteEstado(req, res) {
        try {
            await Synapse.deleteEstado(req.params.id);
            res.json({ ok: true });
        } catch (e) { err(res, e, e.message?.includes('tareas activas') ? 409 : 500); }
    }

    static async reorderEstados(req, res) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids)) return res.status(400).json({ error: 'Se requiere un array de ids.' });
            await Synapse.reorderEstados(ids);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    // ── Etiquetas ──────────────────────────────────────────────────────────────

    static async getEtiquetas(req, res) {
        try {
            res.json(await Synapse.getEtiquetas());
        } catch (e) { err(res, e); }
    }

    static async createEtiqueta(req, res) {
        try {
            const { nombre, color_hex } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            const result = await Synapse.createEtiqueta({ nombre, color_hex });
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async updateEtiqueta(req, res) {
        try {
            await Synapse.updateEtiqueta(req.params.id, req.body);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async deleteEtiqueta(req, res) {
        try {
            await Synapse.deleteEtiqueta(req.params.id);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    // ── Tareas ─────────────────────────────────────────────────────────────────

    static async getTareas(req, res) {
        try {
            const { id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, q } = req.query;
            const data = await Synapse.getTareas({ id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, q });
            res.json(data);
        } catch (e) { err(res, e); }
    }

    static async getTareaById(req, res) {
        try {
            const data = await Synapse.getTareaById(req.params.id);
            if (!data) return res.status(404).json({ error: 'Tarea no encontrada.' });
            res.json(data);
        } catch (e) { err(res, e); }
    }

    static async createTarea(req, res) {
        try {
            const { titulo, id_estado } = req.body;
            if (!titulo) return res.status(400).json({ error: 'El título es requerido.' });
            if (!id_estado) return res.status(400).json({ error: 'El estado es requerido.' });
            const data = await Synapse.createTarea(req.body);

            // Notificación in-app + push al crear ticket
            try {
                let notifTitulo;
                if (data.asignado_nombre) {
                    notifTitulo = `Ticket asignado a ${data.asignado_nombre}`;
                } else if (data.team_nombre) {
                    const emoji = data.team_emoji ? `${data.team_emoji} ` : '';
                    notifTitulo = `Nuevo ticket para equipo ${emoji}${data.team_nombre}`;
                } else {
                    notifTitulo = 'Nuevo ticket creado (sin asignación)';
                }
                await db().ejecutarQuery(
                    `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, NOW(), 'ticket_nuevo')`,
                    [notifTitulo, titulo]
                );
                emitUpdate('ncf:update');
                sendPushToAll(notifTitulo, titulo, '/synapse').catch(() => {});
            } catch (ne) {
                console.error('[SYNAPSE] Error al crear notificación:', ne.message);
            }

            res.status(201).json(data);
        } catch (e) { err(res, e); }
    }

    static async updateTarea(req, res) {
        try {
            const data = await Synapse.updateTarea(req.params.id, req.body);
            res.json(data);
        } catch (e) { err(res, e); }
    }

    static async updateTareaEstado(req, res) {
        try {
            const { id_estado } = req.body;
            if (!id_estado) return res.status(400).json({ error: 'id_estado es requerido.' });
            await Synapse.updateTareaEstado(req.params.id, id_estado);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async deleteTarea(req, res) {
        try {
            await Synapse.deleteTarea(req.params.id);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    // ── Comentarios ────────────────────────────────────────────────────────────

    static async getComentarios(req, res) {
        try {
            res.json(await Synapse.getComentarios(req.params.id));
        } catch (e) { err(res, e); }
    }

    static async createComentario(req, res) {
        try {
            const { contenido } = req.body;
            if (!contenido?.trim()) return res.status(400).json({ error: 'El contenido es requerido.' });
            const result = await Synapse.createComentario(req.params.id, contenido.trim());
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async deleteComentario(req, res) {
        try {
            await Synapse.deleteComentario(req.params.cid);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    // ── Teams ─────────────────────────────────────────────────────────────────

    static async getTeams(req, res) {
        try {
            res.json(await Synapse.getTeams());
        } catch (e) { err(res, e); }
    }

    static async createTeam(req, res) {
        try {
            const { nombre, emoji, color_hex } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            const result = await Synapse.createTeam({ nombre, emoji, color_hex });
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async updateTeam(req, res) {
        try {
            await Synapse.updateTeam(req.params.id, req.body);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async deleteTeam(req, res) {
        try {
            await Synapse.deleteTeam(req.params.id);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    // ── Meta ───────────────────────────────────────────────────────────────────

    static async getProyectosParaSynapse(req, res) {
        try {
            res.json(await Synapse.getProyectosActivos());
        } catch (e) { err(res, e); }
    }

    static async getSociosParaSynapse(req, res) {
        try {
            res.json(await Synapse.getSociosActivos());
        } catch (e) { err(res, e); }
    }

    // ── Production Cockpit ─────────────────────────────────────────────────────

    static async getCockpit(req, res) {
        try {
            const { mes, anio } = req.query;
            const data = await Synapse.getCockpitData({ mes, anio });
            res.json(data);
        } catch (e) { err(res, e); }
    }

    static async updateCockpit(req, res) {
        try {
            const { id } = req.params;
            const { servidor, url_front, cockpit_observaciones } = req.body;
            await Synapse.updateCockpitRow(id, { servidor, url_front, cockpit_observaciones });
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async getCockpitConfig(req, res) {
        try {
            const config = new ConfiguracionFinanciera();
            res.json(await config.getCockpitConfig());
        } catch (e) { err(res, e); }
    }

    static async updateCockpitConfig(req, res) {
        try {
            const { meta_mensual, cockpit_columnas } = req.body;
            const config = new ConfiguracionFinanciera();
            await config.updateCockpitConfig({ meta_mensual, cockpit_columnas });
            res.json({ ok: true, data: await config.getCockpitConfig() });
        } catch (e) { err(res, e); }
    }

    static async sendCockpitEmail(req, res) {
        try {
            const { to, subject, body, attachments = [] } = req.body;
            if (!to || !subject || !body) {
                return res.status(400).json({ error: 'Faltan campos: to, subject, body.' });
            }
            // Validar adjuntos: máx 5 archivos, cada base64 ≤ 10MB aprox
            const safeAttachments = (Array.isArray(attachments) ? attachments : [])
                .filter(a => a?.content && a?.name)
                .slice(0, 5);

            const recipients = to.split(',').map(e => e.trim()).filter(Boolean);
            if (!recipients.length) return res.status(400).json({ error: 'Email destinatario inválido.' });

            const safeBody = body
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');

            const year = new Date().getFullYear();

            const safeSubject = subject.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

            const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f2f2f7;padding:44px 16px 56px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:660px;width:100%;background:#ffffff;border-radius:16px;
                    box-shadow:0 1px 4px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.07);
                    overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:36px 52px 28px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.1em;
                      text-transform:uppercase;color:#8e8e93;">
              NativeCode Finance
            </p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#1d1d1f;
                       letter-spacing:-.5px;line-height:1.25;">
              ${safeSubject}
            </h1>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 52px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="border-top:1px solid #e5e5ea;"></td></tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 52px 36px;">
            <p style="margin:0;font-size:15px;line-height:1.8;color:#3a3a3c;font-weight:400;">
              ${safeBody}
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 52px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="border-top:1px solid #e5e5ea;"></td></tr>
            </table>
          </td>
        </tr>

        <!-- Contact -->
        <tr>
          <td style="padding:24px 52px 32px;">
            <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">
              Para consultas, puede contactarnos en
              <a href="mailto:ingenieria.software@nativecode.cl"
                 style="color:#6366f1;text-decoration:none;font-weight:500;">
                ingenieria.software@nativecode.cl
              </a>
              o al <strong style="color:#3a3a3c;">+56 9 3291 2943</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9fb;border-top:1px solid #e5e5ea;padding:18px 52px;">
            <p style="margin:0;font-size:12px;color:#aeaeb2;text-align:center;letter-spacing:.01em;">
              NativeCode Finance &nbsp;·&nbsp; Correo oficial &nbsp;·&nbsp; © ${year}
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`;

            const results = await Promise.all(recipients.map(email =>
                sendBrevoEmail({
                    senderName:   'NativeCode',
                    senderEmail:  'contacto@nativecode.cl',
                    to:           email,
                    subject,
                    htmlContent,
                    textContent:  body,
                    logPrefix:    '[COCKPIT-EMAIL]',
                    attachments:  safeAttachments,
                })
            ));
            const allOk = results.every(Boolean);

            if (allOk) {
                res.json({ ok: true, enviados: recipients.length });
            } else {
                res.status(500).json({ error: 'Hubo un error al enviar uno o más correos.' });
            }
        } catch (e) { err(res, e); }
    }

    // ── Servidores ─────────────────────────────────────────────────────────────

    static async getServidores(req, res) {
        try {
            res.json(await Synapse.getServidores());
        } catch (e) { err(res, e); }
    }

    static async createServidor(req, res) {
        try {
            const { ruta_backend, estado, id_proyecto, version, notas } = req.body;
            if (!ruta_backend) return res.status(400).json({ error: 'ruta_backend es requerido.' });
            const result = await Synapse.createServidor({ ruta_backend, estado, id_proyecto, version, notas });
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async updateServidor(req, res) {
        try {
            await Synapse.updateServidor(req.params.id, req.body);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }

    static async deleteServidor(req, res) {
        try {
            await Synapse.deleteServidor(req.params.id);
            res.json({ ok: true });
        } catch (e) { err(res, e); }
    }
}
