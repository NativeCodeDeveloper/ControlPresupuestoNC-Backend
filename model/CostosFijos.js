import DataBase from "../config/Database.js";

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
    async selectAllCostosFijos() {
        const conexion = DataBase.getInstance();
        const query = `SELECT cf.*, s.nombre as servicio_nombre 
                       FROM costos_fijos cf
                       LEFT JOIN servicios s ON cf.servicio_id = s.id
                       ORDER BY cf.fecha_inicio DESC`;
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos fijos de la base de datos');
        }
    }

    // OBTENER COSTOS FIJOS ACTIVOS
    async selectCostosFixoActivos() {
        const conexion = DataBase.getInstance();
        const query = `SELECT cf.*, s.nombre as servicio_nombre 
                       FROM costos_fijos cf
                       LEFT JOIN servicios s ON cf.servicio_id = s.id
                       WHERE cf.fecha_fin IS NULL OR cf.fecha_fin >= CURDATE()
                       ORDER BY cf.fecha_inicio DESC`;
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener costos fijos activos');
        }
    }

    // OBTENER COSTO FIJO POR ID
    async selectCostoFijoById(id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT cf.*, s.nombre as servicio_nombre 
                       FROM costos_fijos cf
                       LEFT JOIN servicios s ON cf.servicio_id = s.id
                       WHERE cf.id = ?`;
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener costo fijo de la base de datos');
        }
    }

    // CREAR NUEVO COSTO FIJO
    async insertCostoFijo(servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas) {
        const conexion = DataBase.getInstance();
        const query = `INSERT INTO costos_fijos (servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const param = [servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear costo fijo en la base de datos');
        }
    }

    // ACTUALIZAR COSTO FIJO
    async updateCostoFijo(id, servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas) {
        const conexion = DataBase.getInstance();
        const query = `UPDATE costos_fijos SET servicio_id = ?, proveedor = ?, monto = ?, frecuencia = ?, 
                       fecha_pago = ?, fecha_inicio = ?, fecha_fin = ?, notas = ? WHERE id = ?`;
        const param = [servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar costo fijo en la base de datos');
        }
    }

    // DESACTIVAR COSTO FIJO (establecer fecha_fin)
    async desactivarCostoFijo(id, fecha_fin) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE costos_fijos SET fecha_fin = ? WHERE id = ?';
        const param = [fecha_fin, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al desactivar costo fijo');
        }
    }

    // ELIMINAR COSTO FIJO
    async deleteCostoFijo(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM costos_fijos WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar costo fijo de la base de datos');
        }
    }
}
