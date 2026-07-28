import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let serviciosColumnsCache = null;

const getServiciosColumns = async (conexion) => {
    if (serviciosColumnsCache) return serviciosColumnsCache;

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'servicios'`,
        []
    );

    serviciosColumnsCache = new Set(
        (Array.isArray(rows) ? rows : [])
            .map((row) => String(row.COLUMN_NAME || "").trim())
            .filter(Boolean)
    );

    return serviciosColumnsCache;
};

const hasServiciosColumn = async (conexion, columnName) => {
    const cols = await getServiciosColumns(conexion);
    return cols.has(columnName);
};

const getServiciosIdColumn = async (conexion) => (
    (await hasServiciosColumn(conexion, "id_servicio")) ? "id_servicio" : "id"
);

export default class Servicios {
    constructor(
        id,
        nombre,
        descripcion
    ) {
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
    }

    // OBTENER TODOS LOS SERVICIOS
    async selectAllServicios(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasServiciosColumn(conexion, "activo");
            const hasCategoria = await hasServiciosColumn(conexion, "tipo_costo_variable_id");
            const idColumn = await getServiciosIdColumn(conexion);
            const selectCols = hasCategoria
                ? `s.*, s.${idColumn} AS id, tcv.nombre AS categoria_nombre`
                : `s.*, s.${idColumn} AS id`;
            const joinClause = hasCategoria
                ? "LEFT JOIN tipos_costos_variables tcv ON tcv.id_tipo_costo_variable = s.tipo_costo_variable_id"
                : "";
            let query = hasActivo
                ? `SELECT ${selectCols} FROM servicios s ${joinClause} WHERE s.activo = 1 ORDER BY s.nombre`
                : `SELECT ${selectCols} FROM servicios s ${joinClause} WHERE s.descripcion IS NULL OR s.descripcion NOT LIKE ? ORDER BY s.nombre`;
            const params = hasActivo ? [] : [`${SOFT_DELETE_PREFIX}%`];
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener servicios de la base de datos');
        }
    }

    // OBTENER SERVICIO POR ID
    async selectServicioById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasServiciosColumn(conexion, "activo");
            const idColumn = await getServiciosIdColumn(conexion);
            const query = hasActivo
                ? `SELECT *, ${idColumn} AS id FROM servicios WHERE ${idColumn} = ? AND activo = 1`
                : `SELECT *, ${idColumn} AS id FROM servicios WHERE ${idColumn} = ? AND (descripcion IS NULL OR descripcion NOT LIKE ?)`;
            const params = hasActivo ? [id] : [id, `${SOFT_DELETE_PREFIX}%`];

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener servicio de la base de datos');
        }
    }

    // CREAR NUEVO SERVICIO
    async insertServicio(nombre, descripcion, tipoCostoVariableId = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasServiciosColumn(conexion, "activo");
            const hasCategoria = await hasServiciosColumn(conexion, "tipo_costo_variable_id");
            const cols = ["nombre", "descripcion", ...(hasActivo ? ["activo"] : []), ...(hasCategoria ? ["tipo_costo_variable_id"] : [])];
            const placeholders = ["?", "?", ...(hasActivo ? ["1"] : []), ...(hasCategoria ? ["?"] : [])];
            const params = [nombre, descripcion, ...(hasCategoria ? [tipoCostoVariableId] : [])];
            const query = `INSERT INTO servicios (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear servicio en la base de datos');
        }
    }

    // ACTUALIZAR SERVICIO
    async updateServicio(id, nombre, descripcion, tipoCostoVariableId = undefined) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasServiciosColumn(conexion, "activo");
            const hasCategoria = await hasServiciosColumn(conexion, "tipo_costo_variable_id") && tipoCostoVariableId !== undefined;
            const idColumn = await getServiciosIdColumn(conexion);
            const setClause = ["nombre = ?", "descripcion = ?", ...(hasCategoria ? ["tipo_costo_variable_id = ?"] : [])];
            const whereClause = hasActivo
                ? `${idColumn} = ? AND activo = 1`
                : `${idColumn} = ? AND (descripcion IS NULL OR descripcion NOT LIKE ?)`;
            const query = `UPDATE servicios SET ${setClause.join(", ")} WHERE ${whereClause}`;
            const params = [
                nombre, descripcion, ...(hasCategoria ? [tipoCostoVariableId] : []),
                id, ...(hasActivo ? [] : [`${SOFT_DELETE_PREFIX}%`]),
            ];

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar servicio en la base de datos');
        }
    }

    // ELIMINAR SERVICIO
    async deleteServicio(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasServiciosColumn(conexion, "activo");
            const idColumn = await getServiciosIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasServiciosColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE servicios SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE servicios SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${Date.now()}#`;
            return await conexion.ejecutarQuery(
                `UPDATE servicios SET descripcion = CONCAT(?, COALESCE(descripcion, '')) WHERE ${idColumn} = ? AND (descripcion IS NULL OR descripcion NOT LIKE ?)`,
                [marker, id, `${SOFT_DELETE_PREFIX}%`]
            );
        } catch (error) {
            throw new Error('Error al eliminar servicio de la base de datos');
        }
    }
}
