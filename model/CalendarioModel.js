import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// Convierte cualquier fecha a formato MySQL DATETIME (UTC, para almacenamiento)
function toMySQL(val) {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Convierte Date object (UTC del servidor) a string en hora Santiago SIN "Z"
// Así el browser la parsea como hora local y no aplica offset UTC
function toSantiago(val) {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return null;
    // sv-SE devuelve "YYYY-MM-DD HH:MM:SS" → reemplazamos espacio por T
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Santiago',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).format(d).replace(' ', 'T');
}

export async function getEventos({ desde, hasta, categoria, color, tag, creado_por }) {
    let where = `e.activo = 1 AND e.fecha_inicio < ? AND e.fecha_fin >= ?`;
    const params = [hasta, desde];

    if (categoria) { where += ` AND e.categoria = ?`; params.push(categoria); }
    if (color)     { where += ` AND e.color = ?`;     params.push(color); }
    if (creado_por){ where += ` AND e.creado_por = ?`; params.push(creado_por); }

    let eventos = await db().ejecutarQuery(
        `SELECT e.* FROM calendario_eventos e
         ${tag ? `JOIN evento_tags et ON et.id_evento = e.id AND et.tag = ?` : ''}
         WHERE ${where}
         ORDER BY e.fecha_inicio ASC`,
        tag ? [tag, ...params] : params
    );

    if (!eventos.length) return [];

    const ids = eventos.map(e => e.id);
    const placeholders = ids.map(() => '?').join(',');

    const [tags, participantes, recordatorios] = await Promise.all([
        db().ejecutarQuery(`SELECT * FROM evento_tags WHERE id_evento IN (${placeholders})`, ids),
        db().ejecutarQuery(`SELECT * FROM evento_participantes WHERE id_evento IN (${placeholders})`, ids),
        db().ejecutarQuery(`SELECT * FROM evento_recordatorios WHERE id_evento IN (${placeholders})`, ids),
    ]);

    return eventos.map(ev => ({
        ...ev,
        fecha_inicio: toSantiago(ev.fecha_inicio),
        fecha_fin:    toSantiago(ev.fecha_fin),
        tags:          tags.filter(t => t.id_evento === ev.id).map(t => t.tag),
        participantes: participantes.filter(p => p.id_evento === ev.id),
        recordatorios: recordatorios.filter(r => r.id_evento === ev.id),
    }));
}

export async function getEvento(id) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM calendario_eventos WHERE id = ? AND activo = 1`, [id]
    );
    if (!rows[0]) return null;
    const ev = rows[0];
    const [tags, participantes, recordatorios] = await Promise.all([
        db().ejecutarQuery(`SELECT tag FROM evento_tags WHERE id_evento = ?`, [id]),
        db().ejecutarQuery(`SELECT * FROM evento_participantes WHERE id_evento = ?`, [id]),
        db().ejecutarQuery(`SELECT * FROM evento_recordatorios WHERE id_evento = ?`, [id]),
    ]);
    return {
        ...ev,
        fecha_inicio: toSantiago(ev.fecha_inicio),
        fecha_fin:    toSantiago(ev.fecha_fin),
        tags:          tags.map(t => t.tag),
        participantes,
        recordatorios,
    };
}

export async function createEvento({ titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
    categoria, color, meet_link, creado_por, tags = [], participantes = [], recordatorios = [] }) {

    const r = await db().ejecutarQuery(
        `INSERT INTO calendario_eventos (titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
         categoria, color, meet_link, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [titulo, descripcion || null, toMySQL(fecha_inicio), toMySQL(fecha_fin), todo_el_dia ? 1 : 0,
         categoria, color, meet_link || null, creado_por || null]
    );
    const id = r.insertId;

    await Promise.all([
        ...tags.map(tag =>
            db().ejecutarQuery(`INSERT INTO evento_tags (id_evento, tag) VALUES (?, ?)`, [id, tag])
        ),
        ...participantes.map(p =>
            db().ejecutarQuery(
                `INSERT INTO evento_participantes (id_evento, tipo, id_referencia, nombre) VALUES (?, ?, ?, ?)`,
                [id, p.tipo, p.id_referencia, p.nombre || null]
            )
        ),
        ...recordatorios.map(r =>
            db().ejecutarQuery(
                `INSERT INTO evento_recordatorios (id_evento, minutos_antes, tipo) VALUES (?, ?, ?)`,
                [id, r.minutos_antes, r.tipo || 'email']
            )
        ),
    ]);

    return getEvento(id);
}

export async function updateEvento(id, { titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
    categoria, color, meet_link, tags, participantes, recordatorios }) {

    await db().ejecutarQuery(
        `UPDATE calendario_eventos SET titulo=?, descripcion=?, fecha_inicio=?, fecha_fin=?,
         todo_el_dia=?, categoria=?, color=?, meet_link=? WHERE id=? AND activo=1`,
        [titulo, descripcion || null, toMySQL(fecha_inicio), toMySQL(fecha_fin), todo_el_dia ? 1 : 0,
         categoria, color, meet_link || null, id]
    );

    if (tags !== undefined) {
        await db().ejecutarQuery(`DELETE FROM evento_tags WHERE id_evento = ?`, [id]);
        await Promise.all(tags.map(tag =>
            db().ejecutarQuery(`INSERT INTO evento_tags (id_evento, tag) VALUES (?, ?)`, [id, tag])
        ));
    }

    if (participantes !== undefined) {
        await db().ejecutarQuery(`DELETE FROM evento_participantes WHERE id_evento = ?`, [id]);
        await Promise.all(participantes.map(p =>
            db().ejecutarQuery(
                `INSERT INTO evento_participantes (id_evento, tipo, id_referencia, nombre) VALUES (?, ?, ?, ?)`,
                [id, p.tipo, p.id_referencia, p.nombre || null]
            )
        ));
    }

    if (recordatorios !== undefined) {
        await db().ejecutarQuery(
            `DELETE FROM evento_recordatorios WHERE id_evento = ? AND enviado = 0`, [id]
        );
        await Promise.all(recordatorios.map(r =>
            db().ejecutarQuery(
                `INSERT INTO evento_recordatorios (id_evento, minutos_antes, tipo) VALUES (?, ?, ?)`,
                [id, r.minutos_antes, r.tipo || 'email']
            )
        ));
    }

    return getEvento(id);
}

export async function deleteEvento(id) {
    const r = await db().ejecutarQuery(
        `UPDATE calendario_eventos SET activo = 0 WHERE id = ? AND activo = 1`, [id]
    );
    return r.affectedRows > 0;
}

export async function getEventosVencimientos({ desde, hasta }) {
    return db().ejecutarQuery(
        `SELECT id_proyecto AS id_ref, nombre, nombre_cliente,
                fecha_proximo_pago AS fecha_inicio,
                fecha_proximo_pago AS fecha_fin
         FROM proyectos
         WHERE activo = 1
           AND fecha_proximo_pago IS NOT NULL
           AND fecha_proximo_pago >= ?
           AND fecha_proximo_pago < ?`,
        [desde, hasta]
    );
}

export async function getRecordatoriosPendientes() {
    return db().ejecutarQuery(
        `SELECT er.*, e.titulo, e.descripcion, e.fecha_inicio, e.creado_por
         FROM evento_recordatorios er
         JOIN calendario_eventos e ON e.id = er.id_evento AND e.activo = 1
         WHERE er.enviado = 0
           AND DATE_SUB(e.fecha_inicio, INTERVAL er.minutos_antes MINUTE) <= NOW()`,
        []
    );
}

export async function marcarRecordatorioEnviado(id) {
    return db().ejecutarQuery(
        `UPDATE evento_recordatorios SET enviado = 1, enviado_en = NOW() WHERE id = ?`, [id]
    );
}
