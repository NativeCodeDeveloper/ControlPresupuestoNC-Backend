import DataBase from "../config/Database.js";

export default class RetirosSocios {
    constructor() {}

    // OBTENER RETIROS DE UN SOCIO
    async selectRetirosBySocio(socio_id) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM retiros_socios WHERE socio_id = ? ORDER BY fecha_retiro DESC';
        const param = [socio_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener retiros del socio');
        }
    }

    // REGISTRAR RETIRO
    async insertRetiro(socio_id, monto, fecha_retiro, descripcion, numero_comprobante, observaciones) {
        const conexion = DataBase.getInstance();
        const query = `INSERT INTO retiros_socios (socio_id, monto, fecha_retiro, descripcion, numero_comprobante, observaciones)
                VALUES (?, ?, ?, ?, ?, ?)`;
        const param = [socio_id, monto, fecha_retiro, descripcion || 'Retiro de utilidades', numero_comprobante || null, observaciones || null];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al registrar retiro del socio');
        }
    }

    // ELIMINAR RETIRO
    async deleteRetiro(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM retiros_socios WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar retiro');
        }
    }
}
