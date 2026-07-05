import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// ─── Estados ──────────────────────────────────────────────────────────────────

export async function getEstados() {
    return db().ejecutarQuery(
        `SELECT * FROM nexus_actualizacion_estados WHERE activo = 1 ORDER BY orden`,
        []
    );
}

export async function createEstado({ nombre, color_hex }) {
    const [maxRow] = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM nexus_actualizacion_estados`, []
    ) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO nexus_actualizacion_estados (nombre, color_hex, orden) VALUES (?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1]
    );
}

export async function deleteEstado(id) {
    return db().ejecutarQuery(
        `UPDATE nexus_actualizacion_estados SET activo = 0 WHERE id_estado = ?`, [id]
    );
}

// ─── Actualizaciones ──────────────────────────────────────────────────────────

export async function getActualizaciones({ estado } = {}) {
    const where = [], params = [];
    if (estado) { where.push('a.id_estado = ?'); params.push(estado); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return db().ejecutarQuery(
        `SELECT a.*, s.nombre AS socio_nombre,
                e.nombre AS estado_nombre, e.color_hex AS estado_color
         FROM nexus_actualizaciones a
         LEFT JOIN socios s ON a.id_socio = s.id_socio
         LEFT JOIN nexus_actualizacion_estados e ON a.id_estado = e.id_estado
         ${w}
         ORDER BY a.enviado_en DESC
         LIMIT 100`,
        params
    );
}

export async function getActualizacion(id) {
    const rows = await db().ejecutarQuery(
        `SELECT a.*, s.nombre AS socio_nombre,
                e.nombre AS estado_nombre, e.color_hex AS estado_color
         FROM nexus_actualizaciones a
         LEFT JOIN socios s ON a.id_socio = s.id_socio
         LEFT JOIN nexus_actualizacion_estados e ON a.id_estado = e.id_estado
         WHERE a.id_actualizacion = ?`,
        [id]
    );
    return rows?.[0] ?? null;
}

export async function createActualizacion({ titulo, mensaje, destinatarios, id_socio, id_estado, prioridad, modo }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO nexus_actualizaciones
         (titulo, mensaje, destinatarios, total_enviados, total_errores, id_socio, id_estado, prioridad, modo)
         VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)`,
        [titulo, mensaje, JSON.stringify(destinatarios ?? []),
         id_socio ?? null, id_estado ?? null, prioridad ?? 'media', modo ?? 'masivo']
    );
    return result?.insertId ?? null;
}

export async function updateActualizacion(id, campos) {
    const permitidos = ['id_estado', 'titulo', 'mensaje', 'prioridad', 'modo',
                        'destinatarios', 'total_enviados', 'total_errores'];
    const sets = [], params = [];
    for (const [k, v] of Object.entries(campos)) {
        if (permitidos.includes(k) && v !== undefined) {
            sets.push(`${k} = ?`);
            params.push(k === 'destinatarios' && typeof v !== 'string' ? JSON.stringify(v) : v);
        }
    }
    if (!sets.length) return;
    params.push(id);
    return db().ejecutarQuery(
        `UPDATE nexus_actualizaciones SET ${sets.join(', ')} WHERE id_actualizacion = ?`,
        params
    );
}

export async function deleteActualizacion(id) {
    return db().ejecutarQuery(
        `DELETE FROM nexus_actualizaciones WHERE id_actualizacion = ?`, [id]
    );
}
