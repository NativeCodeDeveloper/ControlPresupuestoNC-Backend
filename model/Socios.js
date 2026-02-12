import DataBase from "../config/Database.js";

const executeIfTableExists = async (connection, query, params = []) => {
    try {
        await connection.query(query, params);
    } catch (error) {
        if (error?.code !== "ER_NO_SUCH_TABLE") {
            throw error;
        }
    }
};

export default class Socios {
    constructor(
        id,
        nombre,
        porcentaje_participacion,
        email,
        telefono
    ) {
        this.id = id;
        this.nombre = nombre;
        this.porcentaje_participacion = porcentaje_participacion;
        this.email = email;
        this.telefono = telefono;
    }

    // OBTENER TODOS LOS SOCIOS
    async selectAllSocios() {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM socios ORDER BY nombre';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener socios desde la base de datos');
        }
    }

    // OBTENER UN SOCIO POR ID
    async selectSocioById(id) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM socios WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener socio de la base de datos');
        }
    }

    // CREAR NUEVO SOCIO
    async insertSocio(nombre, porcentaje_participacion, email, telefono) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO socios (nombre, porcentaje_participacion, email, telefono) VALUES (?, ?, ?, ?)';
        const param = [nombre, porcentaje_participacion, email, telefono];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al crear socio en la base de datos');
        }
    }

    // ACTUALIZAR SOCIO
    async updateSocio(id, nombre, porcentaje_participacion, email, telefono) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE socios SET nombre = ?, porcentaje_participacion = ?, email = ?, telefono = ? WHERE id = ?';
        const param = [nombre, porcentaje_participacion, email, telefono, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar socio en la base de datos');
        }
    }

    // ELIMINAR SOCIO
    async deleteSocio(id) {
        const conexion = DataBase.getInstance();
        const connection = await conexion.pool.getConnection();
        try {
            await connection.beginTransaction();

            // Limpiar dependencias históricas que bloquean el borrado por FK (ON DELETE RESTRICT).
            await executeIfTableExists(
                connection,
                "DELETE FROM distribucion_mensual_socios WHERE socio_id = ?",
                [id]
            );
            await executeIfTableExists(
                connection,
                "DELETE FROM retiros_socios WHERE socio_id = ?",
                [id]
            );

            const [resultado] = await connection.query("DELETE FROM socios WHERE id = ?", [id]);
            await connection.commit();
            return resultado;
        } catch (error) {
            try {
                await connection.rollback();
            } catch (_) {
                // noop
            }
            throw new Error('Error al eliminar socio de la base de datos');
        } finally {
            connection.release();
        }
    }

    // ACTUALIZAR SOLO PORCENTAJE
    async updatePorcentaje(id, porcentaje_participacion) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE socios SET porcentaje_participacion = ? WHERE id = ?';
        const param = [porcentaje_participacion, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar porcentaje del socio');
        }
    }
}
