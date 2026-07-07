import * as QA from '../model/QA.js';
import { sendPushToAll } from '../services/pushService.js';
import { emitUpdate } from '../config/socket.js';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

export default class QAController {

    // ─── Estados ─────────────────────────────────────────────────────────────

    static async listarEstados(_req, res) {
        try {
            res.json(await QA.getEstados());
        } catch {
            res.status(500).json({ message: 'Error al obtener estados QA' });
        }
    }

    static async crearEstado(req, res) {
        try {
            const { nombre, color_hex, es_aprobado, es_rechazo } = req.body;
            if (!nombre) return res.status(400).json({ message: 'nombre es requerido' });
            await QA.createEstado({ nombre, color_hex, es_aprobado, es_rechazo });
            res.status(201).json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al crear estado QA' });
        }
    }

    static async eliminarEstado(req, res) {
        try {
            await QA.deleteEstado(req.params.id);
            res.json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al eliminar estado QA' });
        }
    }

    // ─── Etiquetas ────────────────────────────────────────────────────────────

    static async listarEtiquetas(_req, res) {
        try {
            res.json(await QA.getEtiquetas());
        } catch {
            res.status(500).json({ message: 'Error al obtener etiquetas QA' });
        }
    }

    static async crearEtiqueta(req, res) {
        try {
            const { nombre, color_hex } = req.body;
            if (!nombre) return res.status(400).json({ message: 'nombre es requerido' });
            await QA.createEtiqueta({ nombre, color_hex });
            res.status(201).json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al crear etiqueta QA' });
        }
    }

    static async eliminarEtiqueta(req, res) {
        try {
            await QA.deleteEtiqueta(req.params.id);
            res.json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al eliminar etiqueta QA' });
        }
    }

    // ─── Versiones ────────────────────────────────────────────────────────────

    static async listarVersiones(_req, res) {
        try {
            res.json(await QA.getVersiones());
        } catch {
            res.status(500).json({ message: 'Error al obtener versiones QA' });
        }
    }

    static async obtenerVersion(req, res) {
        try {
            const v = await QA.getVersionById(req.params.id);
            if (!v) return res.status(404).json({ message: 'Versión no encontrada' });
            res.json(v);
        } catch {
            res.status(500).json({ message: 'Error al obtener versión QA' });
        }
    }

    static async crearVersion(req, res) {
        try {
            const { nombre, descripcion, id_proyecto, version_tag, estado, fecha_inicio, fecha_objetivo } = req.body;
            if (!nombre) return res.status(400).json({ message: 'nombre es requerido' });
            const id = await QA.createVersion({ nombre, descripcion, id_proyecto, version_tag, estado, fecha_inicio, fecha_objetivo });
            const version = await QA.getVersionById(id);
            emitUpdate('ncf:update');
            res.status(201).json({ ok: true, id_version: id, version });
        } catch (e) {
            console.error('[QAController.crearVersion]', e.message);
            res.status(500).json({ message: 'Error al crear versión QA' });
        }
    }

    static async actualizarVersion(req, res) {
        try {
            await QA.updateVersion(req.params.id, req.body);
            const version = await QA.getVersionById(req.params.id);
            emitUpdate('ncf:update');
            res.json({ ok: true, version });
        } catch {
            res.status(500).json({ message: 'Error al actualizar versión QA' });
        }
    }

    static async eliminarVersion(req, res) {
        try {
            await QA.deleteVersion(req.params.id);
            res.json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al eliminar versión QA' });
        }
    }

    // ─── Casos ────────────────────────────────────────────────────────────────

    static async listarCasos(req, res) {
        try {
            const casos = await QA.getCasos(req.params.id_version, req.query);
            res.json(casos);
        } catch {
            res.status(500).json({ message: 'Error al obtener casos QA' });
        }
    }

    static async obtenerCaso(req, res) {
        try {
            const caso = await QA.getCasoById(req.params.id);
            if (!caso) return res.status(404).json({ message: 'Caso no encontrado' });
            res.json(caso);
        } catch {
            res.status(500).json({ message: 'Error al obtener caso QA' });
        }
    }

    static async crearCaso(req, res) {
        try {
            const { id_version, titulo, tipo, prioridad, id_estado, id_responsable,
                    descripcion, pasos, resultado_esperado, resultado_actual, observaciones } = req.body;

            if (!id_version || !titulo || !id_estado) {
                return res.status(400).json({ message: 'id_version, titulo e id_estado son requeridos' });
            }

            const { id_caso, numero_caso } = await QA.createCaso({
                id_version, titulo, tipo, prioridad, id_estado, id_responsable,
                descripcion, pasos, resultado_esperado, resultado_actual, observaciones
            });

            const caso = await QA.getCasoById(id_caso);

            await QA.addActividad({
                id_caso,
                tipo: 'creacion',
                contenido: `Caso creado — tipo ${tipo ?? 'Funcional'}, prioridad ${prioridad ?? 'media'}`,
                id_socio: req.body.id_socio ?? null
            });

            await db().ejecutarQuery(
                `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, NOW(), 'qa_nuevo')`,
                [`Nuevo caso QA: ${numero_caso}`, `${titulo}`]
            );
            emitUpdate('ncf:update');
            sendPushToAll(`Nuevo caso QA: ${numero_caso}`, titulo, '/nexus/qa').catch(() => {});

            res.status(201).json({ ok: true, id_caso, numero_caso, caso });
        } catch (e) {
            console.error('[QAController.crearCaso]', e.message);
            res.status(500).json({ message: 'Error al crear caso QA' });
        }
    }

    static async actualizarCaso(req, res) {
        try {
            const id   = req.params.id;
            const prev = await QA.getCasoById(id);
            if (!prev) return res.status(404).json({ message: 'Caso no encontrado' });

            const cambioEstado = req.body.id_estado && Number(req.body.id_estado) !== Number(prev.id_estado);

            await QA.updateCaso(id, req.body);
            const caso = await QA.getCasoById(id);

            if (cambioEstado) {
                await QA.addActividad({
                    id_caso: id,
                    tipo: 'cambio_estado',
                    contenido: `Estado cambiado de ${prev.estado_nombre} a ${caso.estado_nombre}`,
                    estado_anterior: prev.estado_nombre,
                    estado_nuevo:    caso.estado_nombre,
                    id_socio: req.body.id_socio ?? null
                });

                await db().ejecutarQuery(
                    `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, NOW(), 'qa_estado')`,
                    [`QA ${prev.numero_caso} → ${caso.estado_nombre}`, `${prev.titulo}`]
                );
                emitUpdate('ncf:update');
                sendPushToAll(
                    `QA ${prev.numero_caso} → ${caso.estado_nombre}`,
                    prev.titulo,
                    '/nexus/qa'
                ).catch(() => {});
            } else {
                await QA.addActividad({
                    id_caso: id,
                    tipo: 'actualizacion',
                    contenido: 'Caso actualizado',
                    id_socio: req.body.id_socio ?? null
                });
            }

            res.json({ ok: true, caso });
        } catch (e) {
            console.error('[QAController.actualizarCaso]', e.message);
            res.status(500).json({ message: 'Error al actualizar caso QA' });
        }
    }

    static async eliminarCaso(req, res) {
        try {
            await QA.deleteCaso(req.params.id);
            res.json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al eliminar caso QA' });
        }
    }

    // ─── Actividad ────────────────────────────────────────────────────────────

    static async listarActividad(req, res) {
        try {
            res.json(await QA.getActividad(req.params.id));
        } catch {
            res.status(500).json({ message: 'Error al obtener actividad QA' });
        }
    }

    static async agregarComentario(req, res) {
        try {
            const { contenido, id_socio } = req.body;
            if (!contenido?.trim()) return res.status(400).json({ message: 'contenido requerido' });
            await QA.addActividad({
                id_caso: req.params.id,
                tipo: 'comentario',
                contenido,
                id_socio: id_socio ?? null
            });
            res.status(201).json({ ok: true });
        } catch {
            res.status(500).json({ message: 'Error al agregar comentario QA' });
        }
    }
}
