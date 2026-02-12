import DataBase from "../config/Database.js";

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
    async selectAllCostosVariables() {
        const conexion = DataBase.getInstance();
        const query = `SELECT cv.*, tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre 
                       FROM costos_variables cv
                       LEFT JOIN tipos_costos_variables tcv ON cv.tipo_costo_id = tcv.id
                       LEFT JOIN proyectos p ON cv.proyecto_id = p.id
                       ORDER BY cv.fecha DESC`;
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables de la base de datos');
        }
    }

    // OBTENER COSTO VARIABLE POR ID
    async selectCostoVariableById(id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT cv.*, tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre 
                       FROM costos_variables cv
                       LEFT JOIN tipos_costos_variables tcv ON cv.tipo_costo_id = tcv.id
                       LEFT JOIN proyectos p ON cv.proyecto_id = p.id
                       WHERE cv.id = ?`;
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener costo variable de la base de datos');
        }
    }

    // OBTENER COSTOS VARIABLES POR TIPO
    async selectCostosPorTipo(tipo_costo_id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT cv.*, tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre 
                       FROM costos_variables cv
                       LEFT JOIN tipos_costos_variables tcv ON cv.tipo_costo_id = tcv.id
                       LEFT JOIN proyectos p ON cv.proyecto_id = p.id
                       WHERE cv.tipo_costo_id = ?
                       ORDER BY cv.fecha DESC`;
        const param = [tipo_costo_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables por tipo');
        }
    }

    // OBTENER COSTOS VARIABLES POR PROYECTO
    async selectCostosPorProyecto(proyecto_id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT cv.*, tcv.nombre as tipo_nombre, p.nombre as proyecto_nombre 
                       FROM costos_variables cv
                       LEFT JOIN tipos_costos_variables tcv ON cv.tipo_costo_id = tcv.id
                       LEFT JOIN proyectos p ON cv.proyecto_id = p.id
                       WHERE cv.proyecto_id = ?
                       ORDER BY cv.fecha DESC`;
        const param = [proyecto_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos variables por proyecto');
        }
    }

    // CREAR NUEVO COSTO VARIABLE
    async insertCostoVariable(tipo_costo_id, concepto, monto, fecha, fecha_vencimiento, proyecto_id, comprobante_url, observaciones) {
        const conexion = DataBase.getInstance();
        const query = `INSERT INTO costos_variables (tipo_costo_id, proyecto_id, concepto, monto, fecha, fecha_vencimiento, comprobante_url, observaciones)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const param = [tipo_costo_id, proyecto_id, concepto, monto, fecha, fecha_vencimiento || null, comprobante_url, observaciones];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            try {
                // Compatibilidad con BD sin columna fecha_vencimiento.
                const fallbackQuery = `INSERT INTO costos_variables (tipo_costo_id, proyecto_id, concepto, monto, fecha, comprobante_url, observaciones)
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
        const query = `UPDATE costos_variables SET tipo_costo_id = ?, proyecto_id = ?, concepto = ?, monto = ?, 
                       fecha = ?, fecha_vencimiento = ?, comprobante_url = ?, observaciones = ? WHERE id = ?`;
        const param = [tipo_costo_id, proyecto_id, concepto, monto, fecha, fecha_vencimiento || null, comprobante_url, observaciones, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            try {
                const fallbackQuery = `UPDATE costos_variables SET tipo_costo_id = ?, proyecto_id = ?, concepto = ?, monto = ?, 
                                       fecha = ?, comprobante_url = ?, observaciones = ? WHERE id = ?`;
                const fallbackParam = [tipo_costo_id, proyecto_id, concepto, monto, fecha, comprobante_url, observaciones, id];
                return await conexion.ejecutarQuery(fallbackQuery, fallbackParam);
            } catch (_) {
                throw new Error('Error al actualizar costo variable en la base de datos');
            }
        }
    }

    // ELIMINAR COSTO VARIABLE
    async deleteCostoVariable(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM costos_variables WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar costo variable de la base de datos');
        }
    }
}
