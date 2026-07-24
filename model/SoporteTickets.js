import DataBase from '../config/Database.js';
import { parsePagination } from '../utils/pagination.js';

const db = () => DataBase.getInstance();

// ─── Número de ticket auto-generado: TK-YYYY-NNNN ────────────────────────────

async function generarNumeroTicket(conexion) {
    const year = new Date().getFullYear();
    const prefix = `TK-${year}-`;
    const [row] = await conexion.ejecutarQuery(
        `SELECT numero_ticket FROM soporte_tickets
         WHERE numero_ticket LIKE ? ORDER BY id_ticket DESC LIMIT 1`,
        [`${prefix}%`]
    ) ?? [];
    const ultimo = row ? parseInt(row.numero_ticket.split('-')[2], 10) : 0;
    const siguiente = String(ultimo + 1).padStart(4, '0');
    return `${prefix}${siguiente}`;
}

// ─── SLA: calcula fecha límite en horas hábiles (L-V 9-18) ───────────────────

function calcularSlaVence(horas) {
    let restantes = horas;
    const fecha = new Date();
    while (restantes > 0) {
        fecha.setHours(fecha.getHours() + 1);
        const dow = fecha.getDay(); // 0=Dom, 6=Sab
        const h = fecha.getHours();
        if (dow >= 1 && dow <= 5 && h >= 9 && h < 18) restantes--;
    }
    return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

// ─── Estados ──────────────────────────────────────────────────────────────────

export async function getEstados() {
    return db().ejecutarQuery(
        `SELECT * FROM soporte_estados WHERE activo = 1 ORDER BY orden`,
        []
    );
}

export async function getEstadoById(id) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM soporte_estados WHERE id_estado = ?`, [id]
    );
    return rows?.[0] ?? null;
}

export async function createEstado({ nombre, color_hex, es_cierre }) {
    const [maxRow] = await db().ejecutarQuery(`SELECT COALESCE(MAX(orden),0)+1 AS next FROM soporte_estados`, []) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO soporte_estados (nombre, color_hex, orden, es_cierre) VALUES (?, ?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1, es_cierre ? 1 : 0]
    );
}

export async function deleteEstado(id) {
    return db().ejecutarQuery(
        `UPDATE soporte_estados SET activo = 0 WHERE id_estado = ?`, [id]
    );
}

export async function reorderEstados(orderedIds) {
    if (!orderedIds.length) return;
    const cases  = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
    const params = orderedIds.flatMap((id, i) => [id, i + 1]);
    const ids    = orderedIds.map(() => '?').join(',');
    await db().ejecutarQuery(
        `UPDATE soporte_estados SET orden = CASE id_estado ${cases} END WHERE id_estado IN (${ids})`,
        [...params, ...orderedIds]
    );
}

// ─── Tickets — CRUD ───────────────────────────────────────────────────────────

export async function getTickets({ estado, prioridad, responsable, ...query } = {}) {
    const where = ['t.eliminado_en IS NULL'];
    const params = [];

    if (estado)      { where.push('t.id_estado = ?');      params.push(estado); }
    if (prioridad)   { where.push('t.prioridad = ?');      params.push(prioridad); }
    if (responsable) { where.push('t.id_responsable = ?'); params.push(responsable); }

    // Cota defensiva: hoy el volumen es bajo (la vista Kanban quiere verlos todos),
    // pero sin límite esto crecería sin control. defaultLimit alto para no afectar
    // el uso actual; ?all=true o ?limit=/?page= quedan disponibles si se necesita.
    const pagination = parsePagination(query, { defaultLimit: 500, maxLimit: 2000 });
    let sql = `SELECT t.*,
                e.nombre AS estado_nombre, e.color_hex AS estado_color, e.es_cierre,
                s.nombre AS responsable_nombre,
                p.nombre AS proyecto_nombre
         FROM soporte_tickets t
         LEFT JOIN soporte_estados  e ON t.id_estado      = e.id_estado
         LEFT JOIN socios           s ON t.id_responsable = s.id_socio
         LEFT JOIN proyectos        p ON t.id_proyecto    = p.id_proyecto
         WHERE ${where.join(' AND ')}
         ORDER BY t.creado_en DESC`;
    if (pagination) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(pagination.limit, pagination.offset);
    }

    return db().ejecutarQuery(sql, params);
}

export async function getTicketById(id) {
    const rows = await db().ejecutarQuery(
        `SELECT t.*,
                e.nombre AS estado_nombre, e.color_hex AS estado_color, e.es_cierre,
                s.nombre AS responsable_nombre,
                p.nombre AS proyecto_nombre
         FROM soporte_tickets t
         LEFT JOIN soporte_estados  e ON t.id_estado      = e.id_estado
         LEFT JOIN socios           s ON t.id_responsable = s.id_socio
         LEFT JOIN proyectos        p ON t.id_proyecto    = p.id_proyecto
         WHERE t.id_ticket = ? AND t.eliminado_en IS NULL`,
        [id]
    );
    return rows?.[0] ?? null;
}

export async function createTicket({ id_proyecto, nombre_cliente, email_cliente, asunto, descripcion, prioridad, sla_horas, id_estado, id_responsable }) {
    const conexion = db();
    const numero_ticket = await generarNumeroTicket(conexion);
    const sla_vence_en  = calcularSlaVence(Number(sla_horas) || 24);

    const result = await conexion.ejecutarQuery(
        `INSERT INTO soporte_tickets
         (numero_ticket, id_proyecto, nombre_cliente, email_cliente, asunto, descripcion,
          prioridad, sla_horas, sla_vence_en, id_estado, id_responsable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numero_ticket, id_proyecto ?? null, nombre_cliente, email_cliente, asunto, descripcion,
         prioridad ?? 'media', sla_horas ?? 24, sla_vence_en, id_estado, id_responsable ?? null]
    );

    return { id_ticket: result.insertId, numero_ticket };
}

export async function updateTicket(id, campos) {
    const permitidos = ['id_estado','id_responsable','prioridad','sla_horas',
                        'resolucion_causa','resolucion_accion','resolucion_resultado',
                        'resolucion_observaciones','cerrado_en','email_apertura_message_id'];
    const sets = [], params = [];

    const nullable = new Set(['id_responsable','resolucion_causa','resolucion_accion',
                             'resolucion_resultado','resolucion_observaciones','cerrado_en',
                             'email_apertura_message_id']);
    for (const [k, v] of Object.entries(campos)) {
        if (permitidos.includes(k) && v !== undefined && (nullable.has(k) || v !== null)) {
            sets.push(`${k} = ?`);
            params.push(v);
        }
    }
    if (!sets.length) return;

    params.push(id);
    return db().ejecutarQuery(
        `UPDATE soporte_tickets SET ${sets.join(', ')} WHERE id_ticket = ?`,
        params
    );
}

export async function deleteTicket(id) {
    return db().ejecutarQuery(
        `UPDATE soporte_tickets SET eliminado_en = NOW() WHERE id_ticket = ?`, [id]
    );
}

// ─── Actividad interna ────────────────────────────────────────────────────────

export async function getActividad(id_ticket) {
    return db().ejecutarQuery(
        `SELECT a.*, s.nombre AS socio_nombre
         FROM soporte_actividad a
         LEFT JOIN socios s ON a.id_socio = s.id_socio
         WHERE a.id_ticket = ?
         ORDER BY a.creado_en ASC`,
        [id_ticket]
    );
}

export async function addActividad({ id_ticket, tipo, contenido, estado_anterior, estado_nuevo, id_socio }) {
    return db().ejecutarQuery(
        `INSERT INTO soporte_actividad (id_ticket, tipo, contenido, estado_anterior, estado_nuevo, id_socio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_ticket, tipo, contenido ?? null, estado_anterior ?? null, estado_nuevo ?? null, id_socio ?? null]
    );
}
