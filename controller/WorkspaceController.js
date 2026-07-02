import * as Workspace from '../model/Workspace.js';

export default class WorkspaceController {

    static async getIniciativas(req, res) {
        try {
            const data = await Workspace.getIniciativas();
            res.json(data);
        } catch (e) {
            console.error('[WORKSPACE] getIniciativas:', e.message);
            res.status(500).json({ error: 'Error al obtener iniciativas' });
        }
    }

    static async getIniciativa(req, res) {
        try {
            const item = await Workspace.getIniciativa(req.params.id);
            if (!item) return res.status(404).json({ error: 'No encontrada' });
            res.json(item);
        } catch (e) {
            console.error('[WORKSPACE] getIniciativa:', e.message);
            res.status(500).json({ error: 'Error al obtener iniciativa' });
        }
    }

    static async createIniciativa(req, res) {
        try {
            const { titulo } = req.body;
            if (!titulo?.trim()) return res.status(400).json({ error: 'El título es requerido' });
            const id = await Workspace.createIniciativa(req.body);
            const item = await Workspace.getIniciativa(id);
            res.status(201).json(item);
        } catch (e) {
            console.error('[WORKSPACE] createIniciativa:', e.message);
            res.status(500).json({ error: 'Error al crear iniciativa' });
        }
    }

    static async updateIniciativa(req, res) {
        try {
            await Workspace.updateIniciativa(req.params.id, req.body);
            const item = await Workspace.getIniciativa(req.params.id);
            res.json(item);
        } catch (e) {
            console.error('[WORKSPACE] updateIniciativa:', e.message);
            res.status(500).json({ error: 'Error al actualizar iniciativa' });
        }
    }

    static async deleteIniciativa(req, res) {
        try {
            await Workspace.deleteIniciativa(req.params.id);
            res.json({ ok: true });
        } catch (e) {
            console.error('[WORKSPACE] deleteIniciativa:', e.message);
            res.status(500).json({ error: 'Error al eliminar iniciativa' });
        }
    }
}
