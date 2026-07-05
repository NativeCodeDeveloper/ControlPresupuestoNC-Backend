import * as Boveda from '../model/BovedaModel.js';

const LOG = '[Boveda]';

export default class BovedaController {

    // ── Entradas ──────────────────────────────────────────────────────────────

    static async listar(_req, res) {
        try {
            res.json(await Boveda.getEntradas() ?? []);
        } catch (e) {
            console.error(`${LOG} listar`, e.message);
            res.status(500).json({ message: 'Error al listar bóveda' });
        }
    }

    static async obtener(req, res) {
        try {
            const entrada = await Boveda.getEntrada(req.params.id);
            if (!entrada) return res.status(404).json({ message: 'Entrada no encontrada' });
            res.json(entrada);
        } catch (e) {
            console.error(`${LOG} obtener`, e.message);
            res.status(500).json({ message: 'Error al obtener entrada' });
        }
    }

    static async obtenerPorProyecto(req, res) {
        try {
            const entrada = await Boveda.getEntradaByProyecto(req.params.id_proyecto);
            res.json(entrada ?? null);
        } catch (e) {
            console.error(`${LOG} obtenerPorProyecto`, e.message);
            res.status(500).json({ message: 'Error al obtener bóveda del proyecto' });
        }
    }

    static async crear(req, res) {
        try {
            const { id_proyecto } = req.body;
            if (!id_proyecto) return res.status(400).json({ message: 'id_proyecto requerido' });
            const id = await Boveda.createEntrada(req.body);
            const entrada = await Boveda.getEntrada(id);
            res.status(201).json({ ok: true, entrada });
        } catch (e) {
            console.error(`${LOG} crear`, e.message);
            if (e.message?.includes('Duplicate entry')) {
                return res.status(409).json({ message: 'Ya existe una entrada de bóveda para este proyecto' });
            }
            res.status(500).json({ message: 'Error al crear entrada' });
        }
    }

    static async actualizar(req, res) {
        try {
            await Boveda.updateEntrada(req.params.id, req.body);
            const entrada = await Boveda.getEntrada(req.params.id);
            res.json({ ok: true, entrada });
        } catch (e) {
            console.error(`${LOG} actualizar`, e.message);
            res.status(500).json({ message: 'Error al actualizar entrada' });
        }
    }

    // ── Env Vars ──────────────────────────────────────────────────────────────

    static async listarEnv(req, res) {
        try {
            res.json(await Boveda.getEnvVars(req.params.id) ?? []);
        } catch (e) {
            console.error(`${LOG} listarEnv`, e.message);
            res.status(500).json({ message: 'Error al listar variables' });
        }
    }

    static async crearEnv(req, res) {
        try {
            const { clave } = req.body;
            if (!clave?.trim()) return res.status(400).json({ message: 'Clave requerida' });
            const id = await Boveda.createEnvVar(req.params.id, req.body);
            res.status(201).json({ ok: true, id_env: id });
        } catch (e) {
            console.error(`${LOG} crearEnv`, e.message);
            res.status(500).json({ message: 'Error al crear variable' });
        }
    }

    static async actualizarEnv(req, res) {
        try {
            await Boveda.updateEnvVar(req.params.envId, req.body);
            res.json({ ok: true });
        } catch (e) {
            console.error(`${LOG} actualizarEnv`, e.message);
            res.status(500).json({ message: 'Error al actualizar variable' });
        }
    }

    static async eliminarEnv(req, res) {
        try {
            await Boveda.deleteEnvVar(req.params.envId);
            res.json({ ok: true });
        } catch (e) {
            console.error(`${LOG} eliminarEnv`, e.message);
            res.status(500).json({ message: 'Error al eliminar variable' });
        }
    }

    // ── Accesos ───────────────────────────────────────────────────────────────

    static async listarAccesos(req, res) {
        try {
            res.json(await Boveda.getAccesos(req.params.id) ?? []);
        } catch (e) {
            console.error(`${LOG} listarAccesos`, e.message);
            res.status(500).json({ message: 'Error al listar accesos' });
        }
    }

    static async crearAcceso(req, res) {
        try {
            const { nombre } = req.body;
            if (!nombre?.trim()) return res.status(400).json({ message: 'Nombre requerido' });
            const id = await Boveda.createAcceso(req.params.id, req.body);
            res.status(201).json({ ok: true, id_acceso: id });
        } catch (e) {
            console.error(`${LOG} crearAcceso`, e.message);
            res.status(500).json({ message: 'Error al crear acceso' });
        }
    }

    static async actualizarAcceso(req, res) {
        try {
            await Boveda.updateAcceso(req.params.accId, req.body);
            res.json({ ok: true });
        } catch (e) {
            console.error(`${LOG} actualizarAcceso`, e.message);
            res.status(500).json({ message: 'Error al actualizar acceso' });
        }
    }

    static async eliminarAcceso(req, res) {
        try {
            await Boveda.deleteAcceso(req.params.accId);
            res.json({ ok: true });
        } catch (e) {
            console.error(`${LOG} eliminarAcceso`, e.message);
            res.status(500).json({ message: 'Error al eliminar acceso' });
        }
    }
}
