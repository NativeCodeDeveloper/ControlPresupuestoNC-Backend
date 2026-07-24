import * as Actualizaciones from '../model/ActualizacionesModel.js';
import { sendBrevoEmail } from '../services/emailUtils.js';
import { buildEmailHtml, escapeHtml } from '../services/emailHtmlBuilder.js';

const SENDER_NAME  = process.env.EMAIL_SENDER_NAME   || 'NativeCode';
const SENDER_EMAIL = process.env.BILLING_REMINDER_TO || process.env.CORREO_RECEPTOR;

function buildHtml(titulo, mensaje, nombreCliente) {
    return buildEmailHtml({
        title: titulo,
        greetingHtml: nombreCliente ? `Estimado/a <strong>${escapeHtml(nombreCliente)}</strong>,` : undefined,
        bodyText: mensaje,
    });
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
