import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTarea(row) {
    const etiquetas = row.etiqueta_ids
        ? row.etiqueta_ids.split(',').map((id, i) => ({
            id_etiqueta: parseInt(id),
            nombre: row.etiqueta_nombres.split(',')[i],
            color_hex: row.etiqueta_colores.split(',')[i],
        }))
        : [];
    const { etiqueta_ids, etiqueta_nombres, etiqueta_colores, ...rest } = row;
    return { ...rest, etiquetas };
}

const TAREA_SELECT = `
    SELECT
        t.id_tarea, t.titulo, t.descripcion, t.prioridad, t.tipo,
        t.fecha_ingreso, t.fecha_vencimiento, t.fecha_completado,
        t.creado_en, t.actualizado_en,
        e.id_estado, e.nombre AS estado_nombre, e.color_hex AS estado_color, e.es_final,
        p.id_proyecto, p.nombre AS proyecto_nombre,
        s.id_socio, s.nombre AS asignado_nombre,
        tm.id_team, tm.nombre AS team_nombre, tm.emoji AS team_emoji, tm.color_hex AS team_color,
        ets.etiqueta_ids, ets.etiqueta_nombres, ets.etiqueta_colores
    FROM synapse_tareas t
    INNER JOIN synapse_estados e ON t.id_estado = e.id_estado
    LEFT JOIN proyectos p ON t.id_proyecto = p.id_proyecto
    LEFT JOIN socios s ON t.id_asignado = s.id_socio
    LEFT JOIN synapse_teams tm ON t.id_team = tm.id_team
    LEFT JOIN (
        SELECT ste.id_tarea,
               GROUP_CONCAT(et.id_etiqueta ORDER BY et.nombre) AS etiqueta_ids,
               GROUP_CONCAT(et.nombre ORDER BY et.nombre)      AS etiqueta_nombres,
               GROUP_CONCAT(et.color_hex ORDER BY et.nombre)   AS etiqueta_colores
        FROM synapse_tarea_etiquetas ste
        INNER JOIN synapse_etiquetas et ON ste.id_etiqueta = et.id_etiqueta
        GROUP BY ste.id_tarea
    ) ets ON t.id_tarea = ets.id_tarea
    WHERE t.activo = 1
`;

// ── Estados ───────────────────────────────────────────────────────────────────

export async function getEstados() {
    return db().ejecutarQuery(
        `SELECT * FROM synapse_estados WHERE activo = 1 ORDER BY orden ASC, id_estado ASC`,
        []
    );
}

export async function createEstado({ nombre, color_hex, es_final, orden }) {
    const maxOrden = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden), 0) AS max_orden FROM synapse_estados`,
        []
    );
    const nextOrden = (maxOrden[0]?.max_orden || 0) + 1;
    const result = await db().ejecutarQuery(
        `INSERT INTO synapse_estados (nombre, color_hex, es_final, orden) VALUES (?, ?, ?, ?)`,
        [nombre, color_hex || '#6B7280', es_final ? 1 : 0, orden ?? nextOrden]
    );
    return { id_estado: result.insertId };
}

export async function updateEstado(id, { nombre, color_hex, es_final, orden }) {
    const fields = [];
    const vals = [];
    if (nombre !== undefined)    { fields.push('nombre = ?');    vals.push(nombre); }
    if (color_hex !== undefined) { fields.push('color_hex = ?'); vals.push(color_hex); }
    if (es_final !== undefined)  { fields.push('es_final = ?');  vals.push(es_final ? 1 : 0); }
    if (orden !== undefined)     { fields.push('orden = ?');     vals.push(orden); }
    if (!fields.length) return;
    vals.push(id);
    await db().ejecutarQuery(`UPDATE synapse_estados SET ${fields.join(', ')} WHERE id_estado = ?`, vals);
}

export async function deleteEstado(id) {
    const used = await db().ejecutarQuery(
        `SELECT COUNT(*) AS cnt FROM synapse_tareas WHERE id_estado = ? AND activo = 1`,
        [id]
    );
    if (used[0]?.cnt > 0) throw new Error('El estado tiene tareas activas y no puede eliminarse.');
    await db().ejecutarQuery(`UPDATE synapse_estados SET activo = 0 WHERE id_estado = ?`, [id]);
}

export async function reorderEstados(orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
        await db().ejecutarQuery(
            `UPDATE synapse_estados SET orden = ? WHERE id_estado = ?`,
            [i + 1, orderedIds[i]]
        );
    }
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────

export async function getEtiquetas() {
    return db().ejecutarQuery(
        `SELECT * FROM synapse_etiquetas WHERE activo = 1 ORDER BY nombre ASC`,
        []
    );
}

export async function createEtiqueta({ nombre, color_hex }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO synapse_etiquetas (nombre, color_hex) VALUES (?, ?)`,
        [nombre, color_hex || '#6B7280']
    );
    return { id_etiqueta: result.insertId };
}

export async function updateEtiqueta(id, { nombre, color_hex }) {
    const fields = [];
    const vals = [];
    if (nombre !== undefined)    { fields.push('nombre = ?');    vals.push(nombre); }
    if (color_hex !== undefined) { fields.push('color_hex = ?'); vals.push(color_hex); }
    if (!fields.length) return;
    vals.push(id);
    await db().ejecutarQuery(`UPDATE synapse_etiquetas SET ${fields.join(', ')} WHERE id_etiqueta = ?`, vals);
}

export async function deleteEtiqueta(id) {
    await db().ejecutarQuery(`UPDATE synapse_etiquetas SET activo = 0 WHERE id_etiqueta = ?`, [id]);
}

// ── Tareas ────────────────────────────────────────────────────────────────────

export async function getTareas({ id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, q } = {}) {
    const conditions = [];
    const vals = [];

    if (id_estado)   { conditions.push('t.id_estado = ?');   vals.push(id_estado); }
    if (id_proyecto) { conditions.push('t.id_proyecto = ?'); vals.push(id_proyecto); }
    if (id_asignado) { conditions.push('t.id_asignado = ?'); vals.push(id_asignado); }
    if (id_team)     { conditions.push('t.id_team = ?');     vals.push(id_team); }
    if (prioridad)   { conditions.push('t.prioridad = ?');   vals.push(prioridad); }
    if (tipo)        { conditions.push('t.tipo = ?');        vals.push(tipo); }
    if (q)           { conditions.push('t.titulo LIKE ?');   vals.push(`%${q}%`); }

    const where = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const rows = await db().ejecutarQuery(
        `${TAREA_SELECT}${where} ORDER BY e.orden ASC, t.creado_en DESC`,
        vals
    );
    return (Array.isArray(rows) ? rows : []).map(parseTarea);
}

export async function getTareaById(id) {
    const rows = await db().ejecutarQuery(
        `${TAREA_SELECT} AND t.id_tarea = ?`,
        [id]
    );
    if (!rows?.length) return null;
    return parseTarea(rows[0]);
}

export async function createTarea({ titulo, descripcion, id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, fecha_ingreso, fecha_vencimiento, etiqueta_ids }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO synapse_tareas
         (titulo, descripcion, id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, fecha_ingreso, fecha_vencimiento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            titulo,
            descripcion || null,
            id_estado,
            id_proyecto || null,
            id_asignado || null,
            id_team || null,
            prioridad || 'media',
            tipo || 'tarea',
            fecha_ingreso || new Date().toISOString().split('T')[0],
            fecha_vencimiento || null,
        ]
    );
    const id = result.insertId;
    if (Array.isArray(etiqueta_ids) && etiqueta_ids.length) {
        await syncEtiquetas(id, etiqueta_ids);
    }
    return getTareaById(id);
}

export async function updateTarea(id, { titulo, descripcion, id_estado, id_proyecto, id_asignado, id_team, prioridad, tipo, fecha_ingreso, fecha_vencimiento, etiqueta_ids }) {
    const fields = [];
    const vals = [];

    if (titulo !== undefined)          { fields.push('titulo = ?');          vals.push(titulo); }
    if (descripcion !== undefined)     { fields.push('descripcion = ?');     vals.push(descripcion || null); }
    if (id_estado !== undefined)       {
        fields.push('id_estado = ?');
        vals.push(id_estado);
        const estado = await db().ejecutarQuery(`SELECT es_final FROM synapse_estados WHERE id_estado = ?`, [id_estado]);
        if (estado[0]?.es_final) {
            fields.push('fecha_completado = ?');
            vals.push(new Date().toISOString().split('T')[0]);
        } else {
            fields.push('fecha_completado = ?');
            vals.push(null);
        }
    }
    if (id_proyecto !== undefined)     { fields.push('id_proyecto = ?');     vals.push(id_proyecto || null); }
    if (id_asignado !== undefined)     { fields.push('id_asignado = ?');     vals.push(id_asignado || null); }
    if (id_team !== undefined)         { fields.push('id_team = ?');         vals.push(id_team || null); }
    if (prioridad !== undefined)       { fields.push('prioridad = ?');       vals.push(prioridad); }
    if (tipo !== undefined)            { fields.push('tipo = ?');            vals.push(tipo); }
    if (fecha_ingreso !== undefined)   { fields.push('fecha_ingreso = ?');   vals.push(fecha_ingreso); }
    if (fecha_vencimiento !== undefined) { fields.push('fecha_vencimiento = ?'); vals.push(fecha_vencimiento || null); }

    if (fields.length) {
        vals.push(id);
        await db().ejecutarQuery(`UPDATE synapse_tareas SET ${fields.join(', ')} WHERE id_tarea = ?`, vals);
    }

    if (Array.isArray(etiqueta_ids)) {
        await syncEtiquetas(id, etiqueta_ids);
    }

    return getTareaById(id);
}

export async function updateTareaEstado(id, id_estado) {
    const estado = await db().ejecutarQuery(
        `SELECT es_final FROM synapse_estados WHERE id_estado = ?`, [id_estado]
    );
    const fechaCompletado = estado[0]?.es_final
        ? new Date().toISOString().split('T')[0]
        : null;

    await db().ejecutarQuery(
        `UPDATE synapse_tareas SET id_estado = ?, fecha_completado = ? WHERE id_tarea = ?`,
        [id_estado, fechaCompletado, id]
    );
}

export async function deleteTarea(id) {
    await db().ejecutarQuery(
        `UPDATE synapse_tareas SET activo = 0, eliminado_en = NOW() WHERE id_tarea = ?`,
        [id]
    );
}

async function syncEtiquetas(id_tarea, etiqueta_ids) {
    await db().ejecutarQuery(`DELETE FROM synapse_tarea_etiquetas WHERE id_tarea = ?`, [id_tarea]);
    if (etiqueta_ids.length) {
        const placeholders = etiqueta_ids.map(() => '(?, ?)').join(', ');
        const vals = etiqueta_ids.flatMap(eid => [id_tarea, eid]);
        await db().ejecutarQuery(
            `INSERT INTO synapse_tarea_etiquetas (id_tarea, id_etiqueta) VALUES ${placeholders}`,
            vals
        );
    }
}

// ── Comentarios ───────────────────────────────────────────────────────────────

export async function getComentarios(id_tarea) {
    return db().ejecutarQuery(
        `SELECT * FROM synapse_comentarios WHERE id_tarea = ? ORDER BY creado_en ASC`,
        [id_tarea]
    );
}

export async function createComentario(id_tarea, contenido) {
    const result = await db().ejecutarQuery(
        `INSERT INTO synapse_comentarios (id_tarea, contenido) VALUES (?, ?)`,
        [id_tarea, contenido]
    );
    return { id_comentario: result.insertId };
}

export async function deleteComentario(id) {
    await db().ejecutarQuery(`DELETE FROM synapse_comentarios WHERE id_comentario = ?`, [id]);
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function getTeams() {
    return db().ejecutarQuery(
        `SELECT * FROM synapse_teams WHERE activo = 1 ORDER BY nombre ASC`,
        []
    );
}

export async function createTeam({ nombre, emoji, color_hex }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO synapse_teams (nombre, emoji, color_hex) VALUES (?, ?, ?)`,
        [nombre, emoji || '👥', color_hex || '#6B7280']
    );
    return { id_team: result.insertId };
}

export async function updateTeam(id, { nombre, emoji, color_hex }) {
    const fields = [];
    const vals = [];
    if (nombre !== undefined)    { fields.push('nombre = ?');    vals.push(nombre); }
    if (emoji !== undefined)     { fields.push('emoji = ?');     vals.push(emoji); }
    if (color_hex !== undefined) { fields.push('color_hex = ?'); vals.push(color_hex); }
    if (!fields.length) return;
    vals.push(id);
    await db().ejecutarQuery(`UPDATE synapse_teams SET ${fields.join(', ')} WHERE id_team = ?`, vals);
}

export async function deleteTeam(id) {
    await db().ejecutarQuery(`UPDATE synapse_tareas SET id_team = NULL WHERE id_team = ? AND activo = 1`, [id]);
    await db().ejecutarQuery(`UPDATE synapse_teams SET activo = 0 WHERE id_team = ?`, [id]);
}

// ── Meta: referencias para formularios ───────────────────────────────────────

export async function getProyectosActivos() {
    return db().ejecutarQuery(
        `SELECT id_proyecto, nombre FROM proyectos WHERE activo = 1 ORDER BY nombre ASC`,
        []
    );
}

export async function getSociosActivos() {
    return db().ejecutarQuery(
        `SELECT id_socio, nombre FROM socios WHERE activo = 1 ORDER BY nombre ASC`,
        []
    );
}
