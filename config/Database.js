import 'dotenv/config';
import mysql from 'mysql2/promise';

class DataBase {
    constructor() {
        // Configuración de la conexión a la base de datos
        // Pool de conexiones para soportar concurrencia
        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            port: Number(process.env.DB_PORT || 3306), // ahora se incluye el puerto
            connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
            waitForConnections: true,
            connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
            maxIdle: Number(process.env.DB_POOL_MAX_IDLE || 10),
            idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 60000),
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            // Evita cola infinita bajo saturación/caída de DB (riesgo de presión de memoria)
            queueLimit: Number(process.env.DB_POOL_QUEUE_LIMIT || 200)
        });
    }

    async cerrarConexion() {
        try {
            await this.pool.end();
            console.log('Pool de conexiones MySQL cerrado correctamente.\n');
        } catch (error) {
            console.error('Error al cerrar el pool de conexiones MySQL:', error);
        }
    }

    // Método para ejecutar consultas SQL
    async ejecutarQuery(query, params) {
        const [rows] = await this.pool.query(query, params);
        return rows;
    }

    // Entrega una conexión dedicada del pool (útil para transacciones)
    async getConnection() {
        return this.pool.getConnection();
    }

    // Ejecuta un bloque dentro de una transacción y libera la conexión siempre
    async withTransaction(work) {
        const connection = await this.getConnection();
        try {
            await connection.beginTransaction();
            const result = await work(connection);
            await connection.commit();
            return result;
        } catch (error) {
            try {
                await connection.rollback();
            } catch (_) {
                // noop
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    static getInstance() {
        if (!DataBase.instance) {
            DataBase.instance = new DataBase();
        }
        return DataBase.instance;
    }
}

export default DataBase;

// Cierre ordenado del pool cuando el proceso termina
if (!global.__db_shutdown_hook) {
    global.__db_shutdown_hook = true;
    const closePool = () => {
        try {
            const db = DataBase.instance;
            if (db && db.pool) {
                db.cerrarConexion();
            }
        } catch (_) { /* noop */ }
    };
    process.on('SIGINT', () => { closePool(); process.exit(0); });
    process.on('SIGTERM', () => { closePool(); process.exit(0); });
    process.on('beforeExit', () => { closePool(); });
}
