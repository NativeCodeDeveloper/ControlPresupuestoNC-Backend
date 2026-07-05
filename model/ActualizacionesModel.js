import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

export async function getActualizaciones() {
    return db().ejecutarQuery(
        `SELECT a.*, s.nombre AS socio_nombre
         FROM nexus_actualizaciones a
         LEFT JOIN socios s ON a.id_socio = s.id_socio
         ORDER BY a.enviado_en DESC
         LIMIT 50`,
        []
    );
}

export async function createActualizacion({ titulo, mensaje, destinatarios, total_enviados, total_errores, id_socio }) {
    return db().ejecutarQuery(
        `INSERT INTO nexus_actualizaciones (titulo, mensaje, destinatarios, total_enviados, total_errores, id_socio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [titulo, mensaje, JSON.stringify(destinatarios), total_enviados ?? 0, total_errores ?? 0, id_socio ?? null]
    );
}
