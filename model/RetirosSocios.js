import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let retirosSociosColumnsCache = null;

const getRetirosSociosColumns = async (conexion) => {
    if (retirosSociosColumnsCache) return retirosSociosColumnsCache;

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'retiros_socios'`,
        []
    );

    retirosSociosColumnsCache = new Set(
        (Array.isArray(rows) ? rows : [])
            .map((row) => String(row.COLUMN_NAME || "").trim())
            .filter(Boolean)
    );

    return retirosSociosColumnsCache;
};

const hasRetirosSociosColumn = async (conexion, columnName) => {
    const cols = await getRetirosSociosColumns(conexion);
    return cols.has(columnName);
};

const getRetiroIdColumn = async (conexion) => (
    (await hasRetirosSociosColumn(conexion, "id_retiro_socio")) ? "id_retiro_socio" : "id"
);

const getRetiroSocioFkColumn = async (conexion) => (
    (await hasRetirosSociosColumn(conexion, "id_socio")) ? "id_socio" : "socio_id"
);

export default class RetirosSocios {
    constructor() {}

    // OBTENER RETIROS DE UN SOCIO
    async selectRetirosBySocio(socio_id, pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasRetirosSociosColumn(conexion, "activo");
            const hasObservaciones = await hasRetirosSociosColumn(conexion, "observaciones");
            const idColumn = await getRetiroIdColumn(conexion);
            const socioColumn = await getRetiroSocioFkColumn(conexion);
            const where = [`${socioColumn} = ?`];
            const param = [socio_id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            let query = `SELECT *, ${idColumn} AS id, ${socioColumn} AS socio_id
                           FROM retiros_socios
                           WHERE ${where.join(" AND ")}
                           ORDER BY fecha_retiro DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                param.push(Number(pagination.limit), Number(pagination.offset));
            }
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener retiros del socio');
        }
    }

    // REGISTRAR RETIRO
    async insertRetiro(socio_id, monto, fecha_retiro, descripcion, numero_comprobante, observaciones) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasRetirosSociosColumn(conexion, "activo");
            const socioColumn = await getRetiroSocioFkColumn(conexion);
            const query = hasActivo
                ? `INSERT INTO retiros_socios (${socioColumn}, monto, fecha_retiro, descripcion, numero_comprobante, observaciones, activo)
                   VALUES (?, ?, ?, ?, ?, ?, 1)`
                : `INSERT INTO retiros_socios (${socioColumn}, monto, fecha_retiro, descripcion, numero_comprobante, observaciones)
                   VALUES (?, ?, ?, ?, ?, ?)`;
            const param = [socio_id, monto, fecha_retiro, descripcion || 'Retiro de utilidades', numero_comprobante || null, observaciones || null];

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al registrar retiro del socio');
        }
    }

    // ELIMINAR RETIRO
    async deleteRetiro(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasRetirosSociosColumn(conexion, "activo");
            const idColumn = await getRetiroIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasRetirosSociosColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE retiros_socios SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE retiros_socios SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}#`;
            const query = `UPDATE retiros_socios
                           SET observaciones = CONCAT(?, COALESCE(observaciones, ''))
                           WHERE ${idColumn} = ? AND (observaciones IS NULL OR observaciones NOT LIKE ?)`;
            return await conexion.ejecutarQuery(query, [marker, id, `${SOFT_DELETE_PREFIX}%`]);
        } catch (error) {
            throw new Error('Error al eliminar retiro');
        }
    }
}
