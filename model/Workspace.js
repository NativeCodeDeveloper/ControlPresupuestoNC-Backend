import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

export async function getIniciativas() {
    return db().ejecutarQuery(
        `SELECT * FROM workspace_iniciativas WHERE activo = 1 ORDER BY orden ASC, created_at DESC`,
        []
    );
}

export async function getIniciativa(id) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM workspace_iniciativas WHERE id_iniciativa = ? AND activo = 1`,
        [id]
    );
    return rows[0] || null;
}

export async function createIniciativa({ titulo, resumen, estado, prioridad, propietario, fecha_objetivo, contenido, color_hex }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO workspace_iniciativas (titulo, resumen, estado, prioridad, propietario, fecha_objetivo, contenido, color_hex)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [titulo, resumen || null, estado || 'activa', prioridad || 'sin_prioridad',
         propietario || null, fecha_objetivo || null, contenido || null, color_hex || '#8B5CF6']
    );
    return result.insertId;
}

export async function updateIniciativa(id, fields) {
    const allowed = ['titulo', 'resumen', 'estado', 'prioridad', 'propietario', 'fecha_objetivo', 'contenido', 'color_hex', 'orden'];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return;
    const set = entries.map(([k]) => `${k} = ?`).join(', ');
    const vals = entries.map(([, v]) => v);
    await db().ejecutarQuery(
        `UPDATE workspace_iniciativas SET ${set}, updated_at = NOW() WHERE id_iniciativa = ?`,
        [...vals, id]
    );
}

export async function deleteIniciativa(id) {
    await db().ejecutarQuery(
        `UPDATE workspace_iniciativas SET activo = 0 WHERE id_iniciativa = ?`,
        [id]
    );
}
