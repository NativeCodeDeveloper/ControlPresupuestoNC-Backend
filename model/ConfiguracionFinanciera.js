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
    async updateConfig(porcentaje_fondo_emergencia, porcentaje_reinversion, tasa_ppm) {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();
            const emergencia = Number(porcentaje_fondo_emergencia);
            const reinversion = Number(porcentaje_reinversion);
            const ppm = tasa_ppm !== undefined ? Number(tasa_ppm) : 1;

            if (!Number.isFinite(emergencia) || !Number.isFinite(reinversion)) {
                throw new Error("Porcentajes inválidos");
            }

            const hasPpm = await this._hasColumn(conexion, 'tasa_ppm');

            const cols = idColumn === "id_configuracion_financiera"
                ? `id_configuracion_financiera, porcentaje_fondo_emergencia, porcentaje_reinversion`
                : `id, porcentaje_fondo_emergencia, porcentaje_reinversion`;
            const vals = [1, emergencia, reinversion];
            const updates = `porcentaje_fondo_emergencia = VALUES(porcentaje_fondo_emergencia), porcentaje_reinversion = VALUES(porcentaje_reinversion)`;

            let query, params;
            if (hasPpm) {
                query = `INSERT INTO configuracion_financiera (${cols}, tasa_ppm) VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE ${updates}, tasa_ppm = VALUES(tasa_ppm)`;
                params = [...vals, ppm];
            } else {
                query = `INSERT INTO configuracion_financiera (${cols}) VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE ${updates}`;
                params = vals;
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar configuración financiera');
        }
    }

    async updateEmisorConfig(emisor) {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();
            const camposEmisor = [
                "emisor_rut", "emisor_razon_social", "emisor_giro",
                "emisor_direccion", "emisor_comuna", "emisor_actividad_economica"
            ];

            const colsPresentes = [];
            const valsPresentes = [];
            for (const campo of camposEmisor) {
                if (await this._hasColumn(conexion, campo)) {
                    colsPresentes.push(campo);
                    valsPresentes.push(emisor?.[campo] ?? null);
                }
            }

            if (colsPresentes.length === 0) {
                return { affectedRows: 0 };
            }

            const idCol = idColumn === "id_configuracion_financiera" ? "id_configuracion_financiera" : "id";
            const cols = [idCol, ...colsPresentes];
            const vals = [1, ...valsPresentes];
            const updates = colsPresentes.map((c) => `${c} = VALUES(${c})`).join(", ");
            const placeholders = vals.map(() => "?").join(", ");

            const query = `INSERT INTO configuracion_financiera (${cols.join(", ")}) VALUES (${placeholders})
                         ON DUPLICATE KEY UPDATE ${updates}`;

            return await conexion.ejecutarQuery(query, vals);
        } catch (error) {
            throw new Error('Error al actualizar datos del emisor');
        }
    }

    async _hasColumn(conexion, columnName) {
        const rows = await conexion.ejecutarQuery(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_financiera' AND COLUMN_NAME = ?`,
            [columnName]
        );
        return Array.isArray(rows) && rows.length > 0;
    }

    // OBTENER CONFIG COCKPIT (meta_mensual + cockpit_columnas)
    async getCockpitConfig() {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();

            const colRows = await conexion.ejecutarQuery(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_financiera'
                 AND COLUMN_NAME IN ('meta_mensual', 'cockpit_columnas')`,
                []
            );
            const colSet = new Set(colRows.map(r => r.COLUMN_NAME));

            const selects = [];
            if (colSet.has('meta_mensual'))     selects.push('meta_mensual');
            if (colSet.has('cockpit_columnas')) selects.push('cockpit_columnas');

            if (!selects.length) return { meta_mensual: 0, cockpit_columnas: null };

            const rows = await conexion.ejecutarQuery(
                `SELECT ${selects.join(', ')} FROM configuracion_financiera WHERE ${idColumn} = 1 LIMIT 1`,
                []
            );
            const row = rows?.[0] || {};

            let cockpit_columnas = null;
            if (row.cockpit_columnas) {
                try {
                    cockpit_columnas = typeof row.cockpit_columnas === 'string'
                        ? JSON.parse(row.cockpit_columnas)
                        : row.cockpit_columnas;
                } catch { cockpit_columnas = null; }
            }

            return {
                meta_mensual:     Number(row.meta_mensual || 0),
                cockpit_columnas,
            };
        } catch (error) {
            throw new Error('Error al obtener configuración del cockpit');
        }
    }

    // ACTUALIZAR CONFIG COCKPIT
    async updateCockpitConfig({ meta_mensual, cockpit_columnas }) {
        const conexion = DataBase.getInstance();
        try {
            const idColumn = await this.getIdColumn();

            const colRows = await conexion.ejecutarQuery(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_financiera'
                 AND COLUMN_NAME IN ('meta_mensual', 'cockpit_columnas')`,
                []
            );
            const colSet = new Set(colRows.map(r => r.COLUMN_NAME));

            const fields = [];
            const vals   = [];

            if (meta_mensual !== undefined && colSet.has('meta_mensual')) {
                fields.push('meta_mensual = ?');
                vals.push(Number(meta_mensual) || 0);
            }
            if (cockpit_columnas !== undefined && colSet.has('cockpit_columnas')) {
                fields.push('cockpit_columnas = ?');
                vals.push(cockpit_columnas ? JSON.stringify(cockpit_columnas) : null);
            }

            if (!fields.length) return;
            vals.push(1);

            await conexion.ejecutarQuery(
                `UPDATE configuracion_financiera SET ${fields.join(', ')} WHERE ${idColumn} = ?`,
                vals
            );
        } catch (error) {
            throw new Error('Error al actualizar configuración del cockpit');
        }
    }
}
