import DataBase from "../config/Database.js";

export default class Catalogos {
    constructor() {}

    // ========================================
    // TIPOS DE PROYECTOS
    // ========================================

    async selectTiposProyectos() {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM tipos_proyectos ORDER BY nombre';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener tipos de proyectos');
        }
    }

    async insertTipoProyecto(nombre, descripcion) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO tipos_proyectos (nombre, descripcion) VALUES (?, ?)';
        const param = [nombre, descripcion || null];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear tipo de proyecto');
        }
    }

    async deleteTipoProyecto(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM tipos_proyectos WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
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
        const query = 'SELECT * FROM estados_proyectos ORDER BY id';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener estados de proyectos');
        }
    }

    async insertEstadoProyecto(nombre, descripcion, color_hex) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO estados_proyectos (nombre, descripcion, color_hex) VALUES (?, ?, ?)';
        const param = [nombre, descripcion || null, color_hex || null];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear estado de proyecto');
        }
    }

    async deleteEstadoProyecto(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM estados_proyectos WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
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
        const query = 'SELECT * FROM tipos_costos_variables ORDER BY nombre';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener tipos de costos variables');
        }
    }

    async insertTipoCostoVariable(nombre, descripcion) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO tipos_costos_variables (nombre, descripcion) VALUES (?, ?)';
        const param = [nombre, descripcion || null];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear tipo de costo variable');
        }
    }

    async deleteTipoCostoVariable(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM tipos_costos_variables WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar tipo de costo variable');
        }
    }
}
