import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * Database.js
 * Clase singleton que gestiona el pool de conexiones MySQL para toda la aplicación.
 *
 * Patrón Singleton: garantiza que exista un único pool compartido en todo el proceso Node.js.
 * Usar múltiples pools consumiría conexiones innecesariamente y podría agotar los recursos del servidor.
 *
 * Variables de entorno requeridas:
 *   DB_HOST          - Host del servidor MySQL (ej: localhost, IP o dominio)
 *   DB_USER          - Usuario de la BD
 *   DB_PASS          - Contraseña de la BD
 *   DB_DATABASE      - Nombre de la base de datos
 *
 * Variables de entorno opcionales (con defaults seguros):
 *   DB_PORT                    - Puerto MySQL (default: 3306)
 *   DB_CONNECT_TIMEOUT_MS      - Timeout de conexión en ms (default: 10000)
 *   DB_POOL_LIMIT              - Máximo de conexiones concurrentes activas (default: 10)
 *   DB_POOL_MAX_IDLE           - Máximo de conexiones inactivas en el pool (default: 10)
 *   DB_POOL_IDLE_TIMEOUT_MS    - Tiempo antes de cerrar una conexión inactiva (default: 60000)
 *   DB_POOL_QUEUE_LIMIT        - Máximo de queries en cola si el pool está lleno (default: 200)
 *                                Limitar la cola evita presión de memoria bajo saturación o caída de BD.
 */
class DataBase {
    constructor() {
        // Crear el pool de conexiones con configuración desde variables de entorno
        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            port: Number(process.env.DB_PORT || 3306),
            // Tiempo máximo para establecer una conexión antes de fallar
            connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
            // Si el pool está lleno, poner la query en cola en vez de rechazarla inmediatamente
            waitForConnections: true,
            // Número máximo de conexiones simultáneas abiertas
            connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
            // Número máximo de conexiones inactivas que el pool mantiene abiertas
            maxIdle: Number(process.env.DB_POOL_MAX_IDLE || 10),
            // Tiempo en ms antes de cerrar una conexión inactiva (liberarla al servidor)
            idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 60000),
            // Enviar pings periódicos para que el servidor no cierre la conexión por inactividad
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            // Limitar la cola de queries pendientes para evitar acumulación ilimitada en memoria
            // bajo saturación o si la BD cae. 200 es un límite conservador para producción.
            queueLimit: Number(process.env.DB_POOL_QUEUE_LIMIT || 200)
        });
    }

    /**
     * cerrarConexion - Cierra ordenadamente el pool y libera todas las conexiones.
     * Se llama al recibir señales de terminación (SIGINT, SIGTERM) para un shutdown limpio.
     */
    async cerrarConexion() {
        try {
            await this.pool.end();
            console.log('Pool de conexiones MySQL cerrado correctamente.\n');
        } catch (error) {
            console.error('Error al cerrar el pool de conexiones MySQL:', error);
        }
    }

    /**
     * ejecutarQuery - Ejecuta una query SQL con parámetros y retorna las filas resultantes.
     * Método principal para queries simples (SELECT, INSERT, UPDATE, DELETE).
     * Para operaciones que requieren atomicidad usar `withTransaction`.
     *
     * @param {string} query - Query SQL con placeholders (?)
     * @param {Array}  params - Valores para los placeholders
     * @returns {Array} Filas del resultado (SELECT) o metadata (INSERT/UPDATE/DELETE)
     */
    async ejecutarQuery(query, params) {
        const [rows] = await this.pool.query(query, params);
        return rows;
    }

    /**
     * getConnection - Obtiene una conexión dedicada del pool.
     * IMPORTANTE: Siempre se debe llamar `connection.release()` al terminar,
     * preferentemente en un bloque `finally`. Para transacciones, usar `withTransaction`.
     *
     * @returns {Promise<PoolConnection>} Conexión del pool
     */
    async getConnection() {
        return this.pool.getConnection();
    }

    /**
     * withTransaction - Ejecuta un bloque de operaciones dentro de una transacción.
     * Garantiza que la conexión siempre se libera al pool (bloque finally),
     * hace commit si el bloque termina exitosamente, o rollback si lanza error.
     *
     * Uso:
     *   const resultado = await db.withTransaction(async (conn) => {
     *     await conn.query('INSERT ...');
     *     await conn.query('UPDATE ...');
     *     return { ok: true };
     *   });
     *
     * @param {Function} work - Función async que recibe la conexión y ejecuta las queries
     * @returns {*} El valor retornado por `work`
     * @throws Relanza el error de `work` después de hacer rollback
     */
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
                // Silenciar error de rollback para que el error original se propague
            }
            throw error;
        } finally {
            // Siempre liberar la conexión al pool, independiente de éxito o error
            connection.release();
        }
    }

    /**
     * getInstance - Retorna la instancia singleton de DataBase.
     * Crea el pool la primera vez; las llamadas posteriores devuelven la misma instancia.
     * Usar este método siempre en vez de `new DataBase()` para garantizar un único pool.
     *
     * @returns {DataBase} Instancia singleton
     */
    static getInstance() {
        if (!DataBase.instance) {
            DataBase.instance = new DataBase();
        }
        return DataBase.instance;
    }
}

export default DataBase;

// ========================================
// SHUTDOWN HOOK - Cierre ordenado del pool
// ========================================
// Se registra una sola vez (flag global) para evitar duplicados si el módulo se importa
// múltiples veces (ej: en tests o HMR de desarrollo).
if (!global.__db_shutdown_hook) {
    global.__db_shutdown_hook = true;

    const closePool = () => {
        try {
            const db = DataBase.instance;
            if (db && db.pool) {
                // Cierre asíncrono; no esperamos la resolución porque el proceso está terminando
                db.cerrarConexion();
            }
        } catch (_) { /* noop */ }
    };

    // SIGINT: Ctrl+C en desarrollo
    process.on('SIGINT', () => { closePool(); process.exit(0); });
    // SIGTERM: señal de terminación enviada por Docker, PM2, o el sistema operativo
    process.on('SIGTERM', () => { closePool(); process.exit(0); });
    // beforeExit: cuando el event loop queda vacío (cierre natural sin señal)
    process.on('beforeExit', () => { closePool(); });
}
