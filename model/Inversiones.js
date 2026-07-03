import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let inversionesColumnsCache = null;
let inversionesColumnsCachePromise = null;

const getInversionesColumns = async (conexion) => {
    if (inversionesColumnsCache) return inversionesColumnsCache;
    if (inversionesColumnsCachePromise) return inversionesColumnsCachePromise;
    inversionesColumnsCachePromise = (async () => {

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'inversiones'`,
        []
    );

        inversionesColumnsCache = new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.COLUMN_NAME || "").trim())
                .filter(Boolean)
        );
        return inversionesColumnsCache;
    })();
    return inversionesColumnsCachePromise;
};

const hasInversionesColumn = async (conexion, columnName) => {
    const cols = await getInversionesColumns(conexion);
    return cols.has(columnName);
};

const getInversionIdColumn = async (conexion) => (
    (await hasInversionesColumn(conexion, "id_inversion")) ? "id_inversion" : "id"
);

export default class Inversiones {
    constructor() {}

    async selectAllInversiones(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasInversionesColumn(conexion, "activo");
            const hasObservaciones = await hasInversionesColumn(conexion, "observaciones");
            const idColumn = await getInversionIdColumn(conexion);
            const where = [];
            const params = [];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
            let query = `SELECT *, ${idColumn} AS id FROM inversiones ${whereClause} ORDER BY fecha_inversion DESC, ${idColumn} DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }
            return await conexion.ejecutarQuery(query, params);
        } catch (error) {
            throw new Error("Error al obtener inversiones");
        }
    }

    async selectInversionById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasInversionesColumn(conexion, "activo");
            const hasObservaciones = await hasInversionesColumn(conexion, "observaciones");
            const idColumn = await getInversionIdColumn(conexion);
            const where = [`${idColumn} = ?`];
            const params = [id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const rows = await conexion.ejecutarQuery(
                `SELECT *, ${idColumn} AS id FROM inversiones WHERE ${where.join(" AND ")} LIMIT 1`,
                params
            );
            return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error("Error al obtener inversión");
        }
    }

    async insertInversion(concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, tipo_movimiento) {
        const conexion = DataBase.getInstance();
        const hasActivo = await hasInversionesColumn(conexion, "activo");

        try {
            return await conexion.ejecutarQuery(
                hasActivo
                    ? `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, tipo_movimiento, activo)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
                    : `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, tipo_movimiento)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    concepto,
                    monto,
                    fecha_inversion,
                    categoria || "Otro",
                    fondo_origen || "reinversion",
                    observaciones || null,
                    tipo_movimiento || "inversion"
                ]
            );
        } catch (_) {
            try {
                return await conexion.ejecutarQuery(
                    hasActivo
                        ? `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, activo)
                           VALUES (?, ?, ?, ?, ?, ?, 1)`
                        : `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones)
                           VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        concepto,
                        monto,
                        fecha_inversion,
                        categoria || "Otro",
                        fondo_origen || "reinversion",
                        observaciones || null
                    ]
                );
            } catch (_) {
                try {
                    return await conexion.ejecutarQuery(
                        hasActivo
                            ? `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, observaciones, activo)
                               VALUES (?, ?, ?, ?, ?, 1)`
                            : `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, observaciones)
                               VALUES (?, ?, ?, ?, ?)`,
                        [
                            concepto,
                            monto,
                            fecha_inversion,
                            categoria || "Otro",
                            observaciones || null
                        ]
                    );
                } catch (error) {
                    throw new Error("Error al crear inversión");
                }
            }
        }
    }

    async deleteInversion(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasInversionesColumn(conexion, "activo");
            const idColumn = await getInversionIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasInversionesColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE inversiones SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE inversiones SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}#`;
            return await conexion.ejecutarQuery(
                `UPDATE inversiones
                 SET observaciones = CONCAT(?, COALESCE(observaciones, ''))
                 WHERE ${idColumn} = ? AND (observaciones IS NULL OR observaciones NOT LIKE ?)`,
                [marker, id, `${SOFT_DELETE_PREFIX}%`]
            );
        } catch (error) {
            throw new Error("Error al eliminar inversión");
        }
    }
}
