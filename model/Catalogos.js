import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
const columnsCache = new Map();
const CATALOGO_PK_PREFERIDO = {
    tipos_proyectos: "id_tipo_proyecto",
    estados_proyectos: "id_estado_proyecto",
    tipos_costos_variables: "id_tipo_costo_variable"
};

const getTableColumns = async (conexion, tableName) => {
    if (columnsCache.has(tableName)) return columnsCache.get(tableName);

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );

    const cols = new Set(
        (Array.isArray(rows) ? rows : [])
            .map((row) => String(row.COLUMN_NAME || "").trim())
            .filter(Boolean)
    );

    columnsCache.set(tableName, cols);
    return cols;
};

const hasColumn = async (conexion, tableName, columnName) => {
    const cols = await getTableColumns(conexion, tableName);
    return cols.has(columnName);
};

const getCatalogPkColumn = async (conexion, tableName) => {
    const preferred = CATALOGO_PK_PREFERIDO[tableName] || "id";
    if (await hasColumn(conexion, tableName, preferred)) return preferred;
    return "id";
};

const selectCatalogoActivos = async (conexion, tableName, orderBy = "nombre") => {
    const hasActivo = await hasColumn(conexion, tableName, "activo");
    const idColumn = await getCatalogPkColumn(conexion, tableName);
    const safeOrderBy = await hasColumn(conexion, tableName, orderBy) ? orderBy : "nombre";
    const query = hasActivo
        ? `SELECT *, ${idColumn} AS id FROM ${tableName} WHERE activo = 1 ORDER BY ${safeOrderBy}`
        : `SELECT *, ${idColumn} AS id FROM ${tableName} WHERE descripcion IS NULL OR descripcion NOT LIKE ? ORDER BY ${safeOrderBy}`;
    const params = hasActivo ? [] : [`${SOFT_DELETE_PREFIX}%`];
    return conexion.ejecutarQuery(query, params);
};

const softDeleteCatalogo = async (conexion, tableName, id) => {
    const idColumn = await getCatalogPkColumn(conexion, tableName);
    const hasActivo = await hasColumn(conexion, tableName, "activo");
    if (hasActivo) {
        const hasEliminadoEn = await hasColumn(conexion, tableName, "eliminado_en");
        const query = hasEliminadoEn
            ? `UPDATE ${tableName} SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
            : `UPDATE ${tableName} SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
        return conexion.ejecutarQuery(query, [id]);
    }

    const marker = `${SOFT_DELETE_PREFIX}${Date.now()}#`;
    return conexion.ejecutarQuery(
        `UPDATE ${tableName}
         SET descripcion = CONCAT(?, COALESCE(descripcion, ''))
         WHERE ${idColumn} = ? AND (descripcion IS NULL OR descripcion NOT LIKE ?)`,
        [marker, id, `${SOFT_DELETE_PREFIX}%`]
    );
};

export default class Catalogos {
    constructor() {}

    // ========================================
    // TIPOS DE PROYECTOS
    // ========================================

    async selectTiposProyectos() {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await selectCatalogoActivos(conexion, "tipos_proyectos", "nombre");
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener tipos de proyectos');
        }
    }

    async insertTipoProyecto(nombre, descripcion) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasColumn(conexion, "tipos_proyectos", "activo");
            const query = hasActivo
                ? "INSERT INTO tipos_proyectos (nombre, descripcion, activo) VALUES (?, ?, 1)"
                : "INSERT INTO tipos_proyectos (nombre, descripcion) VALUES (?, ?)";
            const param = [nombre, descripcion || null];
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear tipo de proyecto');
        }
    }

    async deleteTipoProyecto(id) {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await softDeleteCatalogo(conexion, "tipos_proyectos", id);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar tipo de proyecto. Puede estar en uso por proyectos existentes.');
        }
    }

    // ========================================
    // ESTADOS DE PROYECTOS
    // ========================================

    async selectEstadosProyectos() {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await selectCatalogoActivos(conexion, "estados_proyectos", "id_estado_proyecto");
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener estados de proyectos');
        }
    }

    async insertEstadoProyecto(nombre, descripcion, color_hex) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasColumn(conexion, "estados_proyectos", "activo");
            const query = hasActivo
                ? "INSERT INTO estados_proyectos (nombre, descripcion, color_hex, activo) VALUES (?, ?, ?, 1)"
                : "INSERT INTO estados_proyectos (nombre, descripcion, color_hex) VALUES (?, ?, ?)";
            const param = [nombre, descripcion || null, color_hex || null];
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear estado de proyecto');
        }
    }

    async deleteEstadoProyecto(id) {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await softDeleteCatalogo(conexion, "estados_proyectos", id);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar estado de proyecto');
        }
    }

    // ========================================
    // TIPOS DE COSTOS VARIABLES
    // ========================================

    async selectTiposCostosVariables() {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await selectCatalogoActivos(conexion, "tipos_costos_variables", "nombre");
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener tipos de costos variables');
        }
    }

    async insertTipoCostoVariable(nombre, descripcion) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasColumn(conexion, "tipos_costos_variables", "activo");
            const query = hasActivo
                ? "INSERT INTO tipos_costos_variables (nombre, descripcion, activo) VALUES (?, ?, 1)"
                : "INSERT INTO tipos_costos_variables (nombre, descripcion) VALUES (?, ?)";
            const param = [nombre, descripcion || null];
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear tipo de costo variable');
        }
    }

    async deleteTipoCostoVariable(id) {
        const conexion = DataBase.getInstance();
        try {
            const resultado = await softDeleteCatalogo(conexion, "tipos_costos_variables", id);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar tipo de costo variable');
        }
    }
}
