import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let sociosColumnsCache = null;
let sociosColumnsCachePromise = null;

const getSociosColumns = async (conexion) => {
    if (sociosColumnsCache) return sociosColumnsCache;
    if (sociosColumnsCachePromise) return sociosColumnsCachePromise;
    sociosColumnsCachePromise = (async () => {

    const query = `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'socios'
    `;

    const rows = await conexion.ejecutarQuery(query, []);
        sociosColumnsCache = new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.COLUMN_NAME || "").trim())
                .filter(Boolean)
        );
        return sociosColumnsCache;
    })();
    return sociosColumnsCachePromise;
};

const hasSociosColumn = async (conexion, columnName) => {
    const columns = await getSociosColumns(conexion);
    return columns.has(columnName);
};

const getSociosIdColumn = async (conexion) => (
    (await hasSociosColumn(conexion, "id_socio")) ? "id_socio" : "id"
);

export default class Socios {
    constructor(
        id,
        nombre,
        porcentaje_participacion,
        email,
        telefono
    ) {
        this.id = id;
        this.nombre = nombre;
        this.porcentaje_participacion = porcentaje_participacion;
        this.email = email;
        this.telefono = telefono;
    }

    // OBTENER TODOS LOS SOCIOS
    async selectAllSocios(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const idColumn = await getSociosIdColumn(conexion);
            let query = hasActivo
                ? `SELECT *, ${idColumn} AS id FROM socios WHERE activo = 1 ORDER BY nombre`
                : `SELECT *, ${idColumn} AS id FROM socios WHERE nombre NOT LIKE ? ORDER BY nombre`;
            const params = hasActivo ? [] : [`${SOFT_DELETE_PREFIX}%`];
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener socios desde la base de datos');
        }
    }

    // OBTENER UN SOCIO POR ID
    async selectSocioById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const idColumn = await getSociosIdColumn(conexion);
            const query = hasActivo
                ? `SELECT *, ${idColumn} AS id FROM socios WHERE ${idColumn} = ? AND activo = 1`
                : `SELECT *, ${idColumn} AS id FROM socios WHERE ${idColumn} = ? AND nombre NOT LIKE ?`;
            const params = hasActivo ? [id] : [id, `${SOFT_DELETE_PREFIX}%`];

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener socio de la base de datos');
        }
    }

    // CREAR NUEVO SOCIO
    async insertSocio(nombre, porcentaje_participacion, email, telefono) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const query = hasActivo
                ? "INSERT INTO socios (nombre, porcentaje_participacion, email, telefono, activo) VALUES (?, ?, ?, ?, 1)"
                : "INSERT INTO socios (nombre, porcentaje_participacion, email, telefono) VALUES (?, ?, ?, ?)";
            const params = [nombre, porcentaje_participacion, email, telefono];

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear socio en la base de datos');
        }
    }

    // ACTUALIZAR SOCIO
    async updateSocio(id, nombre, porcentaje_participacion, email, telefono) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const idColumn = await getSociosIdColumn(conexion);
            const query = hasActivo
                ? `UPDATE socios SET nombre = ?, porcentaje_participacion = ?, email = ?, telefono = ? WHERE ${idColumn} = ? AND activo = 1`
                : `UPDATE socios SET nombre = ?, porcentaje_participacion = ?, email = ?, telefono = ? WHERE ${idColumn} = ? AND nombre NOT LIKE ?`;
            const params = hasActivo
                ? [nombre, porcentaje_participacion, email, telefono, id]
                : [nombre, porcentaje_participacion, email, telefono, id, `${SOFT_DELETE_PREFIX}%`];

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar socio en la base de datos');
        }
    }

    // ELIMINAR SOCIO
    async deleteSocio(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const idColumn = await getSociosIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasSociosColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE socios SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE socios SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            // Compatibilidad sin migración DB: soft delete por convención en nombre.
            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}`;
            return await conexion.ejecutarQuery(
                `UPDATE socios SET nombre = ?, porcentaje_participacion = 0, email = NULL, telefono = NULL WHERE ${idColumn} = ? AND nombre NOT LIKE ?`,
                [marker, id, `${SOFT_DELETE_PREFIX}%`]
            );
        } catch (error) {
            throw new Error('Error al eliminar socio de la base de datos');
        }
    }

    // ACTUALIZAR SOLO PORCENTAJE
    async updatePorcentaje(id, porcentaje_participacion) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasSociosColumn(conexion, "activo");
            const idColumn = await getSociosIdColumn(conexion);
            const query = hasActivo
                ? `UPDATE socios SET porcentaje_participacion = ? WHERE ${idColumn} = ? AND activo = 1`
                : `UPDATE socios SET porcentaje_participacion = ? WHERE ${idColumn} = ? AND nombre NOT LIKE ?`;
            const params = hasActivo
                ? [porcentaje_participacion, id]
                : [porcentaje_participacion, id, `${SOFT_DELETE_PREFIX}%`];

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar porcentaje del socio');
        }
    }
}
