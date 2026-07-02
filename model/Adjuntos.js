import DataBase from '../config/Database.js';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../config/uploadConfig.js';

const db = () => DataBase.getInstance();

export async function getAdjuntos(entidad, id_entidad) {
    return db().ejecutarQuery(
        `SELECT * FROM adjuntos WHERE entidad = ? AND id_entidad = ? AND activo = 1 ORDER BY creado_en DESC`,
        [entidad, id_entidad]
    );
}

export async function createAdjunto({ entidad, id_entidad, nombre_original, nombre_archivo, mimetype, tamanio }) {
    const r = await db().ejecutarQuery(
        `INSERT INTO adjuntos (entidad, id_entidad, nombre_original, nombre_archivo, mimetype, tamanio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entidad, id_entidad, nombre_original, nombre_archivo, mimetype, tamanio]
    );
    const rows = await db().ejecutarQuery(`SELECT * FROM adjuntos WHERE id_adjunto = ?`, [r.insertId]);
    return rows[0];
}

export async function getAdjunto(id) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM adjuntos WHERE id_adjunto = ? AND activo = 1`, [id]
    );
    return rows[0] || null;
}

export async function deleteAdjunto(id) {
    const adj = await getAdjunto(id);
    if (!adj) return false;
    // Soft delete en BD
    await db().ejecutarQuery(`UPDATE adjuntos SET activo = 0 WHERE id_adjunto = ?`, [id]);
    // Borrar físicamente del disco
    const filePath = path.join(UPLOADS_DIR, adj.nombre_archivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
}
