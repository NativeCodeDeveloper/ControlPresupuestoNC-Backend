import { emitUpdate } from '../config/socket.js';
import * as Calendario from '../model/CalendarioModel.js';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

const CATEGORIAS = new Set(['reunion', 'tarea', 'recordatorio', 'personal', 'vencimiento']);
const COLORES    = new Set(['blue', 'green', 'purple', 'orange', 'pink', 'red']);
const MINUTOS_VALIDOS = new Set([30, 60, 360, 1440]);

function sanitizeTag(t) { return String(t).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '').slice(0, 50); }

export default class CalendarioController {

    static async list(req, res) {
        try {
            const { desde, hasta, categoria, color, tag } = req.query;
            if (!desde || !hasta) return res.status(400).json({ error: 'desde y hasta son requeridos' });

            const eventos = await Calendario.getEventos({
                desde, hasta,
                categoria: CATEGORIAS.has(categoria) ? categoria : undefined,
                color:     COLORES.has(color)         ? color     : undefined,
                tag:       tag ? sanitizeTag(tag) : undefined,
                creado_por: null,
            });

            const vencimientos = await Calendario.getEventosVencimientos({ desde, hasta });
            const venc = vencimientos.map(v => ({
                id:          `venc_${v.id_ref}`,
                titulo:      `Vencimiento: ${v.nombre_cliente || v.nombre}`,
                descripcion: v.nombre,
                fecha_inicio: v.fecha_inicio,
                fecha_fin:    v.fecha_fin,
                categoria:   'vencimiento',
                color:       'red',
                todo_el_dia: 1,
                tags:        [],
                participantes: [],
                recordatorios: [],
                readonly:    true,
            }));

            res.json([...eventos, ...venc]);
        } catch (e) {
            console.error('[CALENDARIO] list:', e.message);
            res.status(500).json({ error: 'Error al obtener eventos' });
        }
    }

    static async get(req, res) {
        try {
            const ev = await Calendario.getEvento(Number(req.params.id));
            if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
            res.json(ev);
        } catch (e) {
            console.error('[CALENDARIO] get:', e.message);
            res.status(500).json({ error: 'Error al obtener evento' });
        }
    }

    static async create(req, res) {
        try {
            const { titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
                    categoria, color, meet_link, participantes, recordatorios } = req.body;
            let { tags } = req.body;

            if (!titulo?.trim())   return res.status(400).json({ error: 'Título requerido' });
            if (!fecha_inicio)     return res.status(400).json({ error: 'fecha_inicio requerido' });
            if (!fecha_fin)        return res.status(400).json({ error: 'fecha_fin requerido' });
            if (!CATEGORIAS.has(categoria)) return res.status(400).json({ error: 'Categoría inválida' });
            if (!COLORES.has(color || 'blue')) return res.status(400).json({ error: 'Color inválido' });

            tags = (tags || []).map(sanitizeTag).filter(Boolean).slice(0, 10);

            const recSanitized = (recordatorios || [])
                .filter(r => MINUTOS_VALIDOS.has(Number(r.minutos_antes)))
                .map(r => ({ minutos_antes: Number(r.minutos_antes), tipo: r.tipo === 'inapp' ? 'inapp' : 'email' }));

            const partSanitized = (participantes || [])
                .filter(p => p.tipo && p.id_referencia)
                .map(p => ({ tipo: p.tipo === 'team' ? 'team' : 'persona', id_referencia: Number(p.id_referencia), nombre: p.nombre || null }));

            const creado_por = req.auth?.userId || null;

            const ev = await Calendario.createEvento({
                titulo: titulo.trim(), descripcion, fecha_inicio, fecha_fin,
                todo_el_dia: !!todo_el_dia, categoria, color: color || 'blue',
                meet_link: meet_link || null, creado_por, tags,
                participantes: partSanitized, recordatorios: recSanitized,
            });

            res.status(201).json(ev);
        } catch (e) {
            console.error('[CALENDARIO] create:', e.message);
            res.status(500).json({ error: 'Error al crear evento' });
        }
    }

    static async update(req, res) {
        try {
            const id = Number(req.params.id);
            const ev = await Calendario.getEvento(id);
            if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });

            const { titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
                    categoria, color, meet_link, participantes, recordatorios } = req.body;
            let { tags } = req.body;

            if (!titulo?.trim())   return res.status(400).json({ error: 'Título requerido' });
            if (!CATEGORIAS.has(categoria)) return res.status(400).json({ error: 'Categoría inválida' });
            if (!COLORES.has(color || 'blue')) return res.status(400).json({ error: 'Color inválido' });

            tags = tags !== undefined ? (tags || []).map(sanitizeTag).filter(Boolean).slice(0, 10) : undefined;

            const recSanitized = recordatorios !== undefined
                ? (recordatorios || [])
                    .filter(r => MINUTOS_VALIDOS.has(Number(r.minutos_antes)))
                    .map(r => ({ minutos_antes: Number(r.minutos_antes), tipo: r.tipo === 'inapp' ? 'inapp' : 'email' }))
                : undefined;

            const partSanitized = participantes !== undefined
                ? (participantes || [])
                    .filter(p => p.tipo && p.id_referencia)
                    .map(p => ({ tipo: p.tipo === 'team' ? 'team' : 'persona', id_referencia: Number(p.id_referencia), nombre: p.nombre || null }))
                : undefined;

            const updated = await Calendario.updateEvento(id, {
                titulo: titulo.trim(), descripcion, fecha_inicio, fecha_fin,
                todo_el_dia: !!todo_el_dia, categoria, color: color || 'blue',
                meet_link: meet_link || null, tags,
                participantes: partSanitized, recordatorios: recSanitized,
            });

            res.json(updated);
        } catch (e) {
            console.error('[CALENDARIO] update:', e.message);
            res.status(500).json({ error: 'Error al actualizar evento' });
        }
    }

    static async remove(req, res) {
        try {
            const ok = await Calendario.deleteEvento(Number(req.params.id));
            if (!ok) return res.status(404).json({ error: 'Evento no encontrado' });
            emitUpdate('ncf:update');
            res.json({ ok: true });
        } catch (e) {
            console.error('[CALENDARIO] remove:', e.message);
            res.status(500).json({ error: 'Error al eliminar evento' });
        }
    }

    // ── Notificaciones in-app ─────────────────────────────────────────────────

    static async getNotificaciones(req, res) {
        try {
            // La limpieza de notificaciones leídas/antiguas se movió a un cron
            // aparte (limpiarNotificacionesAntiguas en calendarioReminderService.js)
            // — antes corría un DELETE en cada poll (cada ~30-40s por cliente activo),
            // generando contención de locks sin necesidad.
            const rows = await db().ejecutarQuery(
                `SELECT * FROM notificaciones_inapp WHERE visto = 0 ORDER BY creado_en DESC LIMIT 50`,
                []
            );
            res.json(rows);
        } catch (e) {
            console.error('[NOTIF]', e.message);
            res.status(500).json({ error: 'Error al obtener notificaciones' });
        }
    }

    static async marcarLeida(req, res) {
        try {
            await db().ejecutarQuery(
                `UPDATE notificaciones_inapp SET visto = 1 WHERE id = ?`,
                [Number(req.params.id)]
            );
            emitUpdate('ncf:update');
            res.json({ ok: true });
        } catch (e) {
            console.error('[NOTIF]', e.message);
            res.status(500).json({ error: 'Error al marcar notificación' });
        }
    }

    static async marcarTodasLeidas(req, res) {
        try {
            await db().ejecutarQuery(`UPDATE notificaciones_inapp SET visto = 1 WHERE visto = 0`, []);
            emitUpdate('ncf:update');
            res.json({ ok: true });
        } catch (e) {
            console.error('[NOTIF]', e.message);
            res.status(500).json({ error: 'Error al marcar notificaciones' });
        }
    }

    // ── Push subscriptions ────────────────────────────────────────────────────

    static async getVapidKey(req, res) {
        const key = process.env.VAPID_PUBLIC_KEY;
        if (!key) return res.status(503).json({ error: 'Push no configurado' });
        res.json({ key });
    }

    static async pushSubscribe(req, res) {
        try {
            const { endpoint, keys } = req.body;
            if (!endpoint || !keys?.p256dh || !keys?.auth)
                return res.status(400).json({ error: 'Suscripción inválida' });

            await db().ejecutarQuery(
                `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
                [endpoint, keys.p256dh, keys.auth]
            );
            emitUpdate('ncf:update');
            res.json({ ok: true });
        } catch (e) {
            console.error('[PUSH]', e.message);
            res.status(500).json({ error: 'Error al suscribir' });
        }
    }

    static async pushUnsubscribe(req, res) {
        try {
            const { endpoint } = req.body;
            if (endpoint) {
                await db().ejecutarQuery(
                    `DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint]
                );
            }
            emitUpdate('ncf:update');
            res.json({ ok: true });
        } catch (e) {
            console.error('[PUSH]', e.message);
            res.status(500).json({ error: 'Error al desuscribir' });
        }
    }
}
