import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// ─── Número de caso auto-generado: QA-YYYY-NNNN ───────────────────────────────

async function generarNumeroCaso(conexion) {
    const year   = new Date().getFullYear();
    const prefix = `QA-${year}-`;
    const [row]  = await conexion.ejecutarQuery(
        `SELECT numero_caso FROM qa_casos WHERE numero_caso LIKE ? ORDER BY id_caso DESC LIMIT 1`,
        [`${prefix}%`]
    ) ?? [];
    const ultimo    = row ? parseInt(row.numero_caso.split('-')[2], 10) : 0;
    const siguiente = String(ultimo + 1).padStart(4, '0');
    return `${prefix}${siguiente}`;
}

// ─── Estados ──────────────────────────────────────────────────────────────────

export async function getEstados() {
    return db().ejecutarQuery(
        `SELECT * FROM qa_estados WHERE activo = 1 ORDER BY orden`, []
    );
}

export async function getEstadoById(id) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM qa_estados WHERE id_estado = ?`, [id]
    );
    return rows?.[0] ?? null;
}

export async function createEstado({ nombre, color_hex, es_aprobado, es_rechazo }) {
    const [maxRow] = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden),0)+1 AS next FROM qa_estados`, []
    ) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO qa_estados (nombre, color_hex, orden, es_aprobado, es_rechazo) VALUES (?, ?, ?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1, es_aprobado ? 1 : 0, es_rechazo ? 1 : 0]
    );
}

export async function deleteEstado(id) {
    return db().ejecutarQuery(
        `UPDATE qa_estados SET activo = 0 WHERE id_estado = ?`, [id]
    );
}

export async function reorderEstados(orderedIds) {
    if (!orderedIds.length) return;
    const cases  = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
    const params = orderedIds.flatMap((id, i) => [id, i + 1]);
    const ids    = orderedIds.map(() => '?').join(',');
    await db().ejecutarQuery(
        `UPDATE qa_estados SET orden = CASE id_estado ${cases} END WHERE id_estado IN (${ids})`,
        [...params, ...orderedIds]
    );
}

// ─── Tipos de caso ──────────────────────────────────────────────────────────

export async function getTipos() {
    return db().ejecutarQuery(
        `SELECT * FROM qa_tipos WHERE activo = 1 ORDER BY orden`, []
    );
}

export async function createTipo({ nombre, color_hex }) {
    const [maxRow] = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden),0)+1 AS next FROM qa_tipos`, []
    ) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO qa_tipos (nombre, color_hex, orden) VALUES (?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1]
    );
}

export async function deleteTipo(id) {
    return db().ejecutarQuery(
        `UPDATE qa_tipos SET activo = 0 WHERE id_tipo = ?`, [id]
    );
}

export async function reorderTipos(orderedIds) {
    if (!orderedIds.length) return;
    const cases  = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
    const params = orderedIds.flatMap((id, i) => [id, i + 1]);
    const ids    = orderedIds.map(() => '?').join(',');
    await db().ejecutarQuery(
        `UPDATE qa_tipos SET orden = CASE id_tipo ${cases} END WHERE id_tipo IN (${ids})`,
        [...params, ...orderedIds]
    );
}

// ─── Prioridades ────────────────────────────────────────────────────────────

export async function getPrioridades() {
    return db().ejecutarQuery(
        `SELECT * FROM qa_prioridades WHERE activo = 1 ORDER BY orden`, []
    );
}

export async function createPrioridad({ nombre, color_hex }) {
    const [maxRow] = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden),0)+1 AS next FROM qa_prioridades`, []
    ) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO qa_prioridades (nombre, color_hex, orden) VALUES (?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1]
    );
}

export async function deletePrioridad(id) {
    return db().ejecutarQuery(
        `UPDATE qa_prioridades SET activo = 0 WHERE id_prioridad = ?`, [id]
    );
}

export async function reorderPrioridades(orderedIds) {
    if (!orderedIds.length) return;
    const cases  = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
    const params = orderedIds.flatMap((id, i) => [id, i + 1]);
    const ids    = orderedIds.map(() => '?').join(',');
    await db().ejecutarQuery(
        `UPDATE qa_prioridades SET orden = CASE id_prioridad ${cases} END WHERE id_prioridad IN (${ids})`,
        [...params, ...orderedIds]
    );
}

// ─── Estados de versión ─────────────────────────────────────────────────────

export async function getVersionEstados() {
    return db().ejecutarQuery(
        `SELECT * FROM qa_version_estados WHERE activo = 1 ORDER BY orden`, []
    );
}

export async function createVersionEstado({ nombre, color_hex, es_aprobado, es_rechazo }) {
    const [maxRow] = await db().ejecutarQuery(
        `SELECT COALESCE(MAX(orden),0)+1 AS next FROM qa_version_estados`, []
    ) ?? [{ next: 1 }];
    return db().ejecutarQuery(
        `INSERT INTO qa_version_estados (nombre, color_hex, orden, es_aprobado, es_rechazo) VALUES (?, ?, ?, ?, ?)`,
        [nombre, color_hex ?? '#6b7280', maxRow?.next ?? 1, es_aprobado ? 1 : 0, es_rechazo ? 1 : 0]
    );
}

export async function deleteVersionEstado(id) {
    return db().ejecutarQuery(
        `UPDATE qa_version_estados SET activo = 0 WHERE id_estado_version = ?`, [id]
    );
}

export async function reorderVersionEstados(orderedIds) {
    if (!orderedIds.length) return;
    const cases  = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
    const params = orderedIds.flatMap((id, i) => [id, i + 1]);
    const ids    = orderedIds.map(() => '?').join(',');
    await db().ejecutarQuery(
        `UPDATE qa_version_estados SET orden = CASE id_estado_version ${cases} END WHERE id_estado_version IN (${ids})`,
        [...params, ...orderedIds]
    );
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

export async function getEtiquetas() {
    return db().ejecutarQuery(`SELECT * FROM qa_etiquetas ORDER BY nombre`, []);
}

export async function createEtiqueta({ nombre, color_hex }) {
    return db().ejecutarQuery(
        `INSERT INTO qa_etiquetas (nombre, color_hex) VALUES (?, ?)`,
        [nombre, color_hex ?? '#6b7280']
    );
}

export async function deleteEtiqueta(id) {
    return db().ejecutarQuery(`DELETE FROM qa_etiquetas WHERE id_etiqueta = ?`, [id]);
}

// ─── Versiones ────────────────────────────────────────────────────────────────

export async function getVersiones() {
    const versiones = await db().ejecutarQuery(
        `SELECT v.*,
                p.nombre AS proyecto_nombre,
                ve.nombre AS estado_nombre, ve.color_hex AS estado_color,
                COUNT(c.id_caso) AS total_casos,
                SUM(CASE WHEN e.es_aprobado = 1 THEN 1 ELSE 0 END) AS casos_aprobados,
                SUM(CASE WHEN e.es_rechazo  = 1 THEN 1 ELSE 0 END) AS casos_rechazados
         FROM qa_versiones v
         LEFT JOIN proyectos p ON v.id_proyecto = p.id_proyecto
         LEFT JOIN qa_version_estados ve ON v.id_estado_version = ve.id_estado_version
         LEFT JOIN qa_casos c ON c.id_version = v.id_version AND c.eliminado_en IS NULL
         LEFT JOIN qa_estados e ON c.id_estado = e.id_estado
         WHERE v.eliminado_en IS NULL
         GROUP BY v.id_version
         ORDER BY v.creado_en DESC`,
        []
    );

    // Distribución de casos por columna del tablero, para pintar el desglose en cada tarjeta de versión.
    const distribucion = await db().ejecutarQuery(
        `SELECT c.id_version, c.id_estado, COUNT(*) AS cantidad
         FROM qa_casos c
         WHERE c.eliminado_en IS NULL
         GROUP BY c.id_version, c.id_estado`,
        []
    );
    const porVersion = {};
    for (const row of (distribucion ?? [])) {
        (porVersion[row.id_version] ??= []).push({ id_estado: row.id_estado, cantidad: row.cantidad });
    }

    return (versiones ?? []).map(v => ({ ...v, casos_por_estado: porVersion[v.id_version] ?? [] }));
}

export async function getVersionById(id) {
    const rows = await db().ejecutarQuery(
        `SELECT v.*, p.nombre AS proyecto_nombre,
                ve.nombre AS estado_nombre, ve.color_hex AS estado_color
         FROM qa_versiones v
         LEFT JOIN proyectos p ON v.id_proyecto = p.id_proyecto
         LEFT JOIN qa_version_estados ve ON v.id_estado_version = ve.id_estado_version
         WHERE v.id_version = ? AND v.eliminado_en IS NULL`,
        [id]
    );
    return rows?.[0] ?? null;
}

export async function createVersion({ nombre, tipo_contexto, nombre_producto, descripcion, id_proyecto, version_tag, id_estado_version, fecha_inicio, fecha_objetivo }) {
    const result = await db().ejecutarQuery(
        `INSERT INTO qa_versiones (nombre, tipo_contexto, nombre_producto, descripcion, id_proyecto, version_tag, id_estado_version, fecha_inicio, fecha_objetivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre,
         tipo_contexto   ?? 'Actualizacion',
         nombre_producto ?? null,
         descripcion     ?? null,
         id_proyecto     ?? null,
         version_tag     ?? null,
         id_estado_version,
         fecha_inicio    ?? null,
         fecha_objetivo  ?? null]
    );
    return result.insertId;
}

export async function updateVersion(id, campos) {
    const permitidos = ['nombre','tipo_contexto','nombre_producto','descripcion','id_proyecto','version_tag','id_estado_version','fecha_inicio','fecha_objetivo'];
    const nullable   = new Set(['nombre_producto','descripcion','id_proyecto','version_tag','fecha_inicio','fecha_objetivo']);
    const sets = [], params = [];
    for (const [k, v] of Object.entries(campos)) {
        if (permitidos.includes(k) && v !== undefined && (nullable.has(k) || v !== null)) {
            sets.push(`${k} = ?`);
            params.push(v);
        }
    }
    if (!sets.length) return;
    params.push(id);
    return db().ejecutarQuery(`UPDATE qa_versiones SET ${sets.join(', ')} WHERE id_version = ?`, params);
}

export async function deleteVersion(id) {
    return db().ejecutarQuery(
        `UPDATE qa_versiones SET eliminado_en = NOW() WHERE id_version = ?`, [id]
    );
}

// ─── Casos ────────────────────────────────────────────────────────────────────

export async function getCasos(id_version, { estado, prioridad, tipo, responsable } = {}) {
    const where  = ['c.id_version = ?', 'c.eliminado_en IS NULL'];
    const params = [id_version];

    if (estado)      { where.push('c.id_estado = ?');      params.push(estado); }
    if (prioridad)   { where.push('c.id_prioridad = ?');   params.push(prioridad); }
    if (tipo)        { where.push('c.id_tipo = ?');        params.push(tipo); }
    if (responsable) { where.push('c.id_responsable = ?'); params.push(responsable); }

    return db().ejecutarQuery(
        `SELECT c.*,
                e.nombre AS estado_nombre, e.color_hex AS estado_color,
                e.es_aprobado, e.es_rechazo,
                t.nombre AS tipo_nombre, t.color_hex AS tipo_color,
                pr.nombre AS prioridad_nombre, pr.color_hex AS prioridad_color,
                s.nombre AS responsable_nombre
         FROM qa_casos c
         LEFT JOIN qa_estados     e  ON c.id_estado      = e.id_estado
         LEFT JOIN qa_tipos       t  ON c.id_tipo        = t.id_tipo
         LEFT JOIN qa_prioridades pr ON c.id_prioridad   = pr.id_prioridad
         LEFT JOIN socios         s  ON c.id_responsable = s.id_socio
         WHERE ${where.join(' AND ')}
         ORDER BY c.creado_en DESC`,
        params
    );
}

export async function getCasoById(id) {
    const rows = await db().ejecutarQuery(
        `SELECT c.*,
                e.nombre AS estado_nombre, e.color_hex AS estado_color,
                e.es_aprobado, e.es_rechazo,
                t.nombre AS tipo_nombre, t.color_hex AS tipo_color,
                pr.nombre AS prioridad_nombre, pr.color_hex AS prioridad_color,
                s.nombre AS responsable_nombre,
                v.nombre AS version_nombre
         FROM qa_casos c
         LEFT JOIN qa_estados     e  ON c.id_estado      = e.id_estado
         LEFT JOIN qa_tipos       t  ON c.id_tipo        = t.id_tipo
         LEFT JOIN qa_prioridades pr ON c.id_prioridad   = pr.id_prioridad
         LEFT JOIN socios         s  ON c.id_responsable = s.id_socio
         LEFT JOIN qa_versiones   v  ON c.id_version     = v.id_version
         WHERE c.id_caso = ? AND c.eliminado_en IS NULL`,
        [id]
    );
    const caso = rows?.[0] ?? null;
    if (!caso) return null;

    const etiquetas = await db().ejecutarQuery(
        `SELECT et.* FROM qa_etiquetas et
         JOIN qa_caso_etiquetas ce ON et.id_etiqueta = ce.id_etiqueta
         WHERE ce.id_caso = ?`,
        [id]
    );
    caso.etiquetas = etiquetas ?? [];
    return caso;
}

export async function createCaso({ id_version, titulo, id_tipo, id_prioridad, id_estado, id_responsable,
                                    descripcion, pasos, resultado_esperado, resultado_actual, observaciones }) {
    const conexion     = db();
    const numero_caso  = await generarNumeroCaso(conexion);

    const result = await conexion.ejecutarQuery(
        `INSERT INTO qa_casos
         (numero_caso, id_version, titulo, id_tipo, id_prioridad, id_estado, id_responsable,
          descripcion, pasos, resultado_esperado, resultado_actual, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numero_caso, id_version, titulo, id_tipo, id_prioridad,
         id_estado, id_responsable ?? null, descripcion ?? null, pasos ?? null,
         resultado_esperado ?? null, resultado_actual ?? null, observaciones ?? null]
    );

    return { id_caso: result.insertId, numero_caso };
}

export async function updateCaso(id, campos) {
    const permitidos = ['titulo','id_tipo','id_prioridad','id_estado','id_responsable',
                        'descripcion','pasos','resultado_esperado','resultado_actual','observaciones'];
    const nullable   = new Set(['id_responsable','descripcion','pasos',
                                'resultado_esperado','resultado_actual','observaciones']);
    const sets = [], params = [];
    for (const [k, v] of Object.entries(campos)) {
        if (permitidos.includes(k) && v !== undefined && (nullable.has(k) || v !== null)) {
            sets.push(`${k} = ?`);
            params.push(v);
        }
    }
    if (!sets.length) return;
    params.push(id);
    return db().ejecutarQuery(`UPDATE qa_casos SET ${sets.join(', ')} WHERE id_caso = ?`, params);
}

export async function deleteCaso(id) {
    return db().ejecutarQuery(
        `UPDATE qa_casos SET eliminado_en = NOW() WHERE id_caso = ?`, [id]
    );
}

// ─── Actividad ────────────────────────────────────────────────────────────────

export async function getActividad(id_caso) {
    return db().ejecutarQuery(
        `SELECT a.*, s.nombre AS socio_nombre
         FROM qa_actividad a
         LEFT JOIN socios s ON a.id_socio = s.id_socio
         WHERE a.id_caso = ?
         ORDER BY a.creado_en ASC`,
        [id_caso]
    );
}

export async function addActividad({ id_caso, tipo, contenido, estado_anterior, estado_nuevo, id_socio }) {
    return db().ejecutarQuery(
        `INSERT INTO qa_actividad (id_caso, tipo, contenido, estado_anterior, estado_nuevo, id_socio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_caso, tipo, contenido ?? null, estado_anterior ?? null, estado_nuevo ?? null, id_socio ?? null]
    );
}
