import * as Synapse from '../model/Synapse.js';

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
            const { id_estado, id_proyecto, id_asignado, prioridad, tipo, q } = req.query;
            const data = await Synapse.getTareas({ id_estado, id_proyecto, id_asignado, prioridad, tipo, q });
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
}
