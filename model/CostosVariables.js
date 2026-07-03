import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let costosVariablesColumnsCache = null;
let costosVariablesColumnsCachePromise = null;

const getCostosVariablesColumns = async (conexion) => {
    if (costosVariablesColumnsCache) return costosVariablesColumnsCache;
    if (costosVariablesColumnsCachePromise) return costosVariablesColumnsCachePromise;
    costosVariablesColumnsCachePromise = (async () => {

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'costos_variables'`,
        []
    );

        costosVariablesColumnsCache = new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.COLUMN_NAME || "").trim())
                .filter(Boolean)
        );
        return costosVariablesColumnsCache;
    })();
    return costosVariablesColumnsCachePromise;
};

const hasCostosVariablesColumn = async (conexion, columnName) => {
    const cols = await getCostosVariablesColumns(conexion);
    return cols.has(columnName);
};

const getCostoVariableIdColumn = async (conexion) => (
    (await hasCostosVariablesColumn(conexion, "id_costo_variable")) ? "id_costo_variable" : "id"
);

const getCostoVariableTipoColumn = async (conexion) => (
    (await hasCostosVariablesColumn(conexion, "id_tipo_costo_variable")) ? "id_tipo_costo_variable" : "tipo_costo_id"
);

const getCostoVariableProyectoColumn = async (conexion) => (
    (await hasCostosVariablesColumn(conexion, "id_proyecto")) ? "id_proyecto" : "proyecto_id"
);

export default class CostosVariables {
    constructor(
        id,
        tipo_costo_id,
        proyecto_id,
        concepto,
        monto,
        fecha,
        fecha_vencimiento,
        comprobante_url,
        observaciones
    ) {
        this.id = id;
        this.tipo_costo_id = tipo_costo_id;
        this.proyecto_id = proyecto_id;
        this.concepto = concepto;
        this.monto = monto;
        this.fecha = fecha;
        this.fecha_vencimiento = fecha_vencimiento;
        this.comprobante_url = comprobante_url;
        this.observaciones = observaciones;
    }

    // OBTENER TODOS LOS COSTOS VARIABLES
    async selectAllCostosVariables(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
            const idColumn = await getCostoVariableIdColumn(conexion);
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_costo_variable" ? "id_tipo_costo_variable" : "id";
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const proyectoPkColumn = proyectoColumn === "id_proyecto" ? "id_proyecto" : "id";
            const where = [];
            const params = [];

            if (hasActivo) {
                where.push("cv.activo = 1");
            } else if (hasObservaciones) {
                where.push("(cv.observaciones IS NULL OR cv.observaciones NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
            let query = `SELECT cv.*, cv.${idColumn} AS id, cv.${tipoColumn} AS tipo_costo_id, cv.${proyectoColumn} AS proyecto_id,
                                  tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre
                           FROM costos_variables cv
                           LEFT JOIN tipos_costos_variables tcv ON cv.${tipoColumn} = tcv.${tipoPkColumn}
                           LEFT JOIN proyectos p ON cv.${proyectoColumn} = p.${proyectoPkColumn}
                           ${whereClause}
                           ORDER BY cv.fecha DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables de la base de datos');
        }
    }

    // OBTENER COSTO VARIABLE POR ID
    async selectCostoVariableById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
            const idColumn = await getCostoVariableIdColumn(conexion);
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_costo_variable" ? "id_tipo_costo_variable" : "id";
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const proyectoPkColumn = proyectoColumn === "id_proyecto" ? "id_proyecto" : "id";
            const where = [`cv.${idColumn} = ?`];
            const param = [id];

            if (hasActivo) {
                where.push("cv.activo = 1");
            } else if (hasObservaciones) {
                where.push("(cv.observaciones IS NULL OR cv.observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `SELECT cv.*, cv.${idColumn} AS id, cv.${tipoColumn} AS tipo_costo_id, cv.${proyectoColumn} AS proyecto_id,
                                  tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre
                           FROM costos_variables cv
                           LEFT JOIN tipos_costos_variables tcv ON cv.${tipoColumn} = tcv.${tipoPkColumn}
                           LEFT JOIN proyectos p ON cv.${proyectoColumn} = p.${proyectoPkColumn}
                           WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener costo variable de la base de datos');
        }
    }

    // OBTENER COSTOS VARIABLES POR TIPO
    async selectCostosPorTipo(tipo_costo_id, pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
            const idColumn = await getCostoVariableIdColumn(conexion);
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_costo_variable" ? "id_tipo_costo_variable" : "id";
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const proyectoPkColumn = proyectoColumn === "id_proyecto" ? "id_proyecto" : "id";
            const where = [`cv.${tipoColumn} = ?`];
            const param = [tipo_costo_id];

            if (hasActivo) {
                where.push("cv.activo = 1");
            } else if (hasObservaciones) {
                where.push("(cv.observaciones IS NULL OR cv.observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            let query = `SELECT cv.*, cv.${idColumn} AS id, cv.${tipoColumn} AS tipo_costo_id, cv.${proyectoColumn} AS proyecto_id,
                                  tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre
                           FROM costos_variables cv
                           LEFT JOIN tipos_costos_variables tcv ON cv.${tipoColumn} = tcv.${tipoPkColumn}
                           LEFT JOIN proyectos p ON cv.${proyectoColumn} = p.${proyectoPkColumn}
                           WHERE ${where.join(" AND ")}
                           ORDER BY cv.fecha DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                param.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables por tipo');
        }
    }

    // OBTENER COSTOS VARIABLES POR PROYECTO
    async selectCostosPorProyecto(proyecto_id, pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
            const idColumn = await getCostoVariableIdColumn(conexion);
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_costo_variable" ? "id_tipo_costo_variable" : "id";
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const proyectoPkColumn = proyectoColumn === "id_proyecto" ? "id_proyecto" : "id";
            const where = [`cv.${proyectoColumn} = ?`];
            const param = [proyecto_id];

            if (hasActivo) {
                where.push("cv.activo = 1");
            } else if (hasObservaciones) {
                where.push("(cv.observaciones IS NULL OR cv.observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            let query = `SELECT cv.*, cv.${idColumn} AS id, cv.${tipoColumn} AS tipo_costo_id, cv.${proyectoColumn} AS proyecto_id,
                                  tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre
                           FROM costos_variables cv
                           LEFT JOIN tipos_costos_variables tcv ON cv.${tipoColumn} = tcv.${tipoPkColumn}
                           LEFT JOIN proyectos p ON cv.${proyectoColumn} = p.${proyectoPkColumn}
                           WHERE ${where.join(" AND ")}
                           ORDER BY cv.fecha DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                param.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables por proyecto');
        }
    }

    // CREAR NUEVO COSTO VARIABLE
    async insertCostoVariable(tipo_costo_id, concepto, monto, fecha, fecha_vencimiento, proyecto_id, comprobante_url, observaciones) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const query = hasActivo
                ? `INSERT INTO costos_variables (${tipoColumn}, ${proyectoColumn}, concepto, monto, fecha, fecha_vencimiento, comprobante_url, observaciones, activo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
                : `INSERT INTO costos_variables (${tipoColumn}, ${proyectoColumn}, concepto, monto, fecha, fecha_vencimiento, comprobante_url, observaciones)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const param = [tipo_costo_id, proyecto_id, concepto, monto, fecha, fecha_vencimiento || null, comprobante_url, observaciones];

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            try {
                // Compatibilidad con BD sin columna fecha_vencimiento.
                const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
                const tipoColumn = await getCostoVariableTipoColumn(conexion);
                const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
                const fallbackQuery = hasActivo
                    ? `INSERT INTO costos_variables (${tipoColumn}, ${proyectoColumn}, concepto, monto, fecha, comprobante_url, observaciones, activo)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
                    : `INSERT INTO costos_variables (${tipoColumn}, ${proyectoColumn}, concepto, monto, fecha, comprobante_url, observaciones)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
                const fallbackParam = [tipo_costo_id, proyecto_id, concepto, monto, fecha, comprobante_url, observaciones];
                return await conexion.ejecutarQuery(fallbackQuery, fallbackParam);
            } catch (_) {
                throw new Error('Error al crear costo variable en la base de datos');
            }
        }
    }

    // ACTUALIZAR COSTO VARIABLE
    async updateCostoVariable(id, tipo_costo_id, concepto, monto, fecha, fecha_vencimiento, proyecto_id, comprobante_url, observaciones) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
            const idColumn = await getCostoVariableIdColumn(conexion);
            const tipoColumn = await getCostoVariableTipoColumn(conexion);
            const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
            const where = [`${idColumn} = ?`];
            const param = [tipo_costo_id, proyecto_id, concepto, monto, fecha, fecha_vencimiento || null, comprobante_url, observaciones, id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `UPDATE costos_variables SET ${tipoColumn} = ?, ${proyectoColumn} = ?, concepto = ?, monto = ?,
                           fecha = ?, fecha_vencimiento = ?, comprobante_url = ?, observaciones = ? WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            try {
                const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
                const hasObservaciones = await hasCostosVariablesColumn(conexion, "observaciones");
                const idColumn = await getCostoVariableIdColumn(conexion);
                const tipoColumn = await getCostoVariableTipoColumn(conexion);
                const proyectoColumn = await getCostoVariableProyectoColumn(conexion);
                const where = [`${idColumn} = ?`];
                const fallbackParam = [tipo_costo_id, proyecto_id, concepto, monto, fecha, comprobante_url, observaciones, id];

                if (hasActivo) {
                    where.push("activo = 1");
                } else if (hasObservaciones) {
                    where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                    fallbackParam.push(`${SOFT_DELETE_PREFIX}%`);
                }

                const fallbackQuery = `UPDATE costos_variables SET ${tipoColumn} = ?, ${proyectoColumn} = ?, concepto = ?, monto = ?,
                                       fecha = ?, comprobante_url = ?, observaciones = ? WHERE ${where.join(" AND ")}`;
                return await conexion.ejecutarQuery(fallbackQuery, fallbackParam);
            } catch (_) {
                throw new Error('Error al actualizar costo variable en la base de datos');
            }
        }
    }

    // ELIMINAR COSTO VARIABLE
    async deleteCostoVariable(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasCostosVariablesColumn(conexion, "activo");
            const idColumn = await getCostoVariableIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasCostosVariablesColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE costos_variables SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE costos_variables SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}#`;
            const query = `UPDATE costos_variables
                           SET observaciones = CONCAT(?, COALESCE(observaciones, ''))
                           WHERE ${idColumn} = ? AND (observaciones IS NULL OR observaciones NOT LIKE ?)`;
            return await conexion.ejecutarQuery(query, [marker, id, `${SOFT_DELETE_PREFIX}%`]);
        } catch (error) {
            throw new Error('Error al eliminar costo variable de la base de datos');
        }
    }
}
