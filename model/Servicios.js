import DataBase from "../config/Database.js";

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
    async selectAllServicios() {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM servicios ORDER BY nombre';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener servicios de la base de datos');
        }
    }

    // OBTENER SERVICIO POR ID
    async selectServicioById(id) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM servicios WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener servicio de la base de datos');
        }
    }

    // CREAR NUEVO SERVICIO
    async insertServicio(nombre, descripcion) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO servicios (nombre, descripcion) VALUES (?, ?)';
        const param = [nombre, descripcion];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear servicio en la base de datos');
        }
    }

    // ACTUALIZAR SERVICIO
    async updateServicio(id, nombre, descripcion) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE servicios SET nombre = ?, descripcion = ? WHERE id = ?';
        const param = [nombre, descripcion, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar servicio en la base de datos');
        }
    }

    // ELIMINAR SERVICIO
    async deleteServicio(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM servicios WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar servicio de la base de datos');
        }
    }
}
