import DataBase from "../config/Database.js";

export default class ConfiguracionFinanciera {
    constructor() {}

    async getIdColumn() {
        const conexion = DataBase.getInstance();
        const rows = await conexion.ejecutarQuery(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'configuracion_financiera'
               AND COLUMN_NAME IN ('id_configuracion_financiera', 'id')`,
            []
        );

        const cols = new Set((rows || []).map((r) => r.COLUMN_NAME));
        return cols.has("id_configuracion_financiera") ? "id_configuracion_financiera" : "id";
    }

    // OBTENER CONFIGURACIÓN FINANCIERA
    async selectConfig() {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();
            const resultado = await conexion.ejecutarQuery(
                `SELECT * FROM configuracion_financiera WHERE ${idColumn} = 1 LIMIT 1`,
                []
            );
            if (Array.isArray(resultado) && resultado.length > 0) {
                return resultado[0];
            }

            const fallback = await conexion.ejecutarQuery(
                `SELECT * FROM configuracion_financiera ORDER BY ${idColumn} ASC LIMIT 1`,
                []
            );
            if (Array.isArray(fallback) && fallback.length > 0) {
                return fallback[0];
            }

            // Si no existe configuración, se crea la base por defecto.
            await this.updateConfig(10, 3);
            const created = await conexion.ejecutarQuery(
                `SELECT * FROM configuracion_financiera WHERE ${idColumn} = 1 LIMIT 1`,
                []
            );
            return Array.isArray(created) && created.length > 0 ? created[0] : null;
        } catch (error) {
            throw new Error('Error al obtener configuración financiera');
        }
    }

    // ACTUALIZAR CONFIGURACIÓN FINANCIERA
    async updateConfig(porcentaje_fondo_emergencia, porcentaje_reinversion) {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();
            const emergencia = Number(porcentaje_fondo_emergencia);
            const reinversion = Number(porcentaje_reinversion);

            if (!Number.isFinite(emergencia) || !Number.isFinite(reinversion)) {
                throw new Error("Porcentajes inválidos");
            }

            const query = idColumn === "id_configuracion_financiera"
                ? `INSERT INTO configuracion_financiera (id_configuracion_financiera, porcentaje_fondo_emergencia, porcentaje_reinversion)
                   VALUES (1, ?, ?)
                   ON DUPLICATE KEY UPDATE
                       porcentaje_fondo_emergencia = VALUES(porcentaje_fondo_emergencia),
                       porcentaje_reinversion = VALUES(porcentaje_reinversion)`
                : `INSERT INTO configuracion_financiera (id, porcentaje_fondo_emergencia, porcentaje_reinversion)
                   VALUES (1, ?, ?)
                   ON DUPLICATE KEY UPDATE
                       porcentaje_fondo_emergencia = VALUES(porcentaje_fondo_emergencia),
                       porcentaje_reinversion = VALUES(porcentaje_reinversion)`;

            const resultado = await conexion.ejecutarQuery(query, [emergencia, reinversion]);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar configuración financiera');
        }
    }
}
