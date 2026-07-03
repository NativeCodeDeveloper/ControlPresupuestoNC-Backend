import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let costosFijosColumnsCache = null;
let costosFijosColumnsCachePromise = null;

const getCostosFijosColumns = async (conexion) => {
    if (costosFijosColumnsCache) return costosFijosColumnsCache;
    if (costosFijosColumnsCachePromise) return costosFijosColumnsCachePromise;
    costosFijosColumnsCachePromise = (async () => {

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'costos_fijos'`,
        []
    );

        costosFijosColumnsCache = new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.COLUMN_NAME || "").trim())
                .filter(Boolean)
        );
        return costosFijosColumnsCache;
    })();
    return costosFijosColumnsCachePromise;
};

const hasCostosFijosColumn = async (conexion, columnName) => {
    const cols = await getCostosFijosColumns(conexion);
    return cols.has(columnName);
};

const getCostoFijoIdColumn = async (conexion) => (
    (await hasCostosFijosColumn(conexion, "id_costo_fijo")) ? "id_costo_fijo" : "id"
);

const getCostoFijoServicioColumn = async (conexion) => (
    (await hasCostosFijosColumn(conexion, "id_servicio")) ? "id_servicio" : "servicio_id"
);

export default class CostosFijos {
    constructor(
        id,
        servicio_id,
        proveedor,
        monto,
        frecuencia,
        fecha_pago,
        fecha_inicio,
        fecha_fin,
        notas
    ) {
        this.id = id;
        this.servicio_id = servicio_id;
        this.proveedor = proveedor;
        this.monto = monto;
        this.frecuencia = frecuencia;
        this.fecha_pago = fecha_pago;
        this.fecha_inicio = fecha_inicio;
        this.fecha_fin = fecha_fin;
        this.notas = notas;
    }

    // OBTENER TODOS LOS COSTOS FIJOS
    async selectAllCostosFijos(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const servicioColumn = await getCostoFijoServicioColumn(conexion);
            const servicioIdColumn = await hasCostosFijosColumn(conexion, "id_servicio") ? "id_servicio" : "id";
            const where = [];
            const params = [];

            if (hasActivo) {
                where.push("cf.activo = 1");
            } else if (hasNotas) {
                where.push("(cf.notas IS NULL OR cf.notas NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
            let query = `SELECT cf.*, cf.${idColumn} AS id, s.${servicioIdColumn} AS servicio_id, s.nombre as servicio_nombre
                           FROM costos_fijos cf
                           LEFT JOIN servicios s ON cf.${servicioColumn} = s.${servicioIdColumn}
                           ${whereClause}
                           ORDER BY cf.fecha_inicio DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos fijos de la base de datos');
        }
    }

    // OBTENER COSTOS FIJOS ACTIVOS
    async selectCostosFixoActivos(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const servicioColumn = await getCostoFijoServicioColumn(conexion);
            const servicioIdColumn = await hasCostosFijosColumn(conexion, "id_servicio") ? "id_servicio" : "id";
            const where = ["(cf.fecha_fin IS NULL OR cf.fecha_fin >= CURDATE())"];
            const params = [];

            if (hasActivo) {
                where.push("cf.activo = 1");
            } else if (hasNotas) {
                where.push("(cf.notas IS NULL OR cf.notas NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            let query = `SELECT cf.*, cf.${idColumn} AS id, s.${servicioIdColumn} AS servicio_id, s.nombre as servicio_nombre
                           FROM costos_fijos cf
                           LEFT JOIN servicios s ON cf.${servicioColumn} = s.${servicioIdColumn}
                           WHERE ${where.join(" AND ")}
                           ORDER BY cf.fecha_inicio DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos fijos activos');
        }
    }

    // OBTENER COSTO FIJO POR ID
    async selectCostoFijoById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const servicioColumn = await getCostoFijoServicioColumn(conexion);
            const servicioIdColumn = await hasCostosFijosColumn(conexion, "id_servicio") ? "id_servicio" : "id";
            const where = [`cf.${idColumn} = ?`];
            const param = [id];

            if (hasActivo) {
                where.push("cf.activo = 1");
            } else if (hasNotas) {
                where.push("(cf.notas IS NULL OR cf.notas NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `SELECT cf.*, cf.${idColumn} AS id, s.${servicioIdColumn} AS servicio_id, s.nombre as servicio_nombre
                           FROM costos_fijos cf
                           LEFT JOIN servicios s ON cf.${servicioColumn} = s.${servicioIdColumn}
                           WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener costo fijo de la base de datos');
        }
    }

    // CREAR NUEVO COSTO FIJO
    async insertCostoFijo(servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const servicioColumn = await getCostoFijoServicioColumn(conexion);
            const query = hasActivo
                ? `INSERT INTO costos_fijos (${servicioColumn}, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas, activo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
                : `INSERT INTO costos_fijos (${servicioColumn}, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const param = [servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas];

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear costo fijo en la base de datos');
        }
    }

    // ACTUALIZAR COSTO FIJO
    async updateCostoFijo(id, servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const servicioColumn = await getCostoFijoServicioColumn(conexion);
            const where = [`${idColumn} = ?`];
            const param = [servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas, id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasNotas) {
                where.push("(notas IS NULL OR notas NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `UPDATE costos_fijos
                           SET ${servicioColumn} = ?, proveedor = ?, monto = ?, frecuencia = ?,
                               fecha_pago = ?, fecha_inicio = ?, fecha_fin = ?, notas = ?
                           WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar costo fijo en la base de datos');
        }
    }

    // DESACTIVAR COSTO FIJO (establecer fecha_fin)
    async desactivarCostoFijo(id, fecha_fin) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const where = [`${idColumn} = ?`];
            const param = [fecha_fin, id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasNotas) {
                where.push("(notas IS NULL OR notas NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `UPDATE costos_fijos SET fecha_fin = ? WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al desactivar costo fijo');
        }
    }

    // REGISTRAR PAGO — actualiza fecha_ultimo_pago para avanzar el recordatorio
    async registrarPago(id, fechaPago) {
        const conexion = DataBase.getInstance();
        try {
            const hasUltimoPago = await hasCostosFijosColumn(conexion, "fecha_ultimo_pago");
            if (!hasUltimoPago) {
                throw new Error("La columna fecha_ultimo_pago no existe. Ejecutar la migración 2026-06-04.");
            }
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const idColumn = await getCostoFijoIdColumn(conexion);
            const where = [`${idColumn} = ?`];
            if (hasActivo) where.push("activo = 1");
            const query = `UPDATE costos_fijos SET fecha_ultimo_pago = ? WHERE ${where.join(" AND ")}`;
            return await conexion.ejecutarQuery(query, [fechaPago, id]);
        } catch (error) {
            throw new Error(`Error al registrar pago del costo fijo: ${error.message}`);
        }
    }

    // ELIMINAR COSTO FIJO
    async deleteCostoFijo(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosFijosColumn(conexion, "activo");
            const hasNotas = await hasCostosFijosColumn(conexion, "notas");
            const hasFechaFin = await hasCostosFijosColumn(conexion, "fecha_fin");
            const idColumn = await getCostoFijoIdColumn(conexion);

            if (hasActivo) {
                const hasEliminadoEn = await hasCostosFijosColumn(conexion, "eliminado_en");
                const setParts = ["activo = 0"];
                if (hasEliminadoEn) setParts.push("eliminado_en = NOW()");
                if (hasFechaFin) setParts.push("fecha_fin = COALESCE(fecha_fin, DATE_SUB(CURDATE(), INTERVAL 1 DAY))");

                const query = `UPDATE costos_fijos
                               SET ${setParts.join(", ")}
                               WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}#`;
            const setParts = [];
            if (hasFechaFin) setParts.push("fecha_fin = COALESCE(fecha_fin, DATE_SUB(CURDATE(), INTERVAL 1 DAY))");
            if (hasNotas) setParts.push("notas = CONCAT(?, COALESCE(notas, ''))");
            if (setParts.length === 0) {
                throw new Error("No hay columnas compatibles para soft delete en costos_fijos");
            }

            const where = hasNotas
                ? `${idColumn} = ? AND (notas IS NULL OR notas NOT LIKE ?)`
                : `${idColumn} = ?`;

            const params = [];
            if (hasNotas) params.push(marker);
            params.push(id);
            if (hasNotas) params.push(`${SOFT_DELETE_PREFIX}%`);

            const query = `UPDATE costos_fijos SET ${setParts.join(", ")} WHERE ${where}`;
            return await conexion.ejecutarQuery(query, params);
        } catch (error) {
            throw new Error('Error al eliminar costo fijo de la base de datos');
        }
    }
}
