import * as Synapse from '../model/Synapse.js';
import ConfiguracionFinanciera from '../model/ConfiguracionFinanciera.js';
import { sendBrevoEmail } from '../services/emailUtils.js';
import { buildEmailHtml } from '../services/emailHtmlBuilder.js';
import { emitUpdate } from '../config/socket.js';
import { sendPushToAll } from '../services/pushService.js';
import DataBase from '../config/Database.js';
import { encryptApiKey } from '../utils/encryption.js';

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

            const htmlContent = buildEmailHtml({
                eyebrow: 'NativeCode Finance',
                title: subject,
                bodyText: body,
                contactHtml: `<p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.7;">
                  Para consultas, puede contactarnos en
                  <a href="mailto:ingenieria.software@nativecode.cl" style="color:#6366f1;text-decoration:none;font-weight:500;">ingenieria.software@nativecode.cl</a>
                  o al <strong style="color:#3a3a3c;">+56 9 3291 2943</strong>.
                </p>`,
                footerText: 'NativeCode Finance · Correo oficial',
            });

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
            const { ruta_backend, estado, id_proyecto, version, notas, api_key } = req.body;
            if (!ruta_backend) return res.status(400).json({ error: 'ruta_backend es requerido.' });

            // Cifrar API key antes de guardar
            let api_key_encrypted = null;
            if (api_key && api_key.trim()) {
                api_key_encrypted = encryptApiKey(api_key.trim());
            }

            const result = await Synapse.createServidor({
                ruta_backend,
                estado,
                id_proyecto,
                version,
                notas,
                api_key_encrypted
            });
            res.status(201).json(result);
        } catch (e) { err(res, e); }
    }

    static async updateServidor(req, res) {
        try {
            const { ruta_backend, estado, id_proyecto, version, notas, api_key } = req.body;

            // Preparar datos para actualizar
            const updateData = { ruta_backend, estado, id_proyecto, version, notas };

            // Si se envía una API key, cifrarla
            if (api_key !== undefined) {
                if (api_key && api_key.trim()) {
                    updateData.api_key_encrypted = encryptApiKey(api_key.trim());
                } else {
                    // Si envían string vacío, eliminar la API key
                    updateData.api_key_encrypted = null;
                }
            }

            await Synapse.updateServidor(req.params.id, updateData);
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
