import DataBase from "../config/Database.js";

export default class Inversiones {
    constructor() {}

    async selectAllInversiones() {
        const conexion = DataBase.getInstance();
        try {
            return await conexion.ejecutarQuery(
                `SELECT * FROM inversiones ORDER BY fecha_inversion DESC, id DESC`,
                []
            );
        } catch (error) {
            throw new Error("Error al obtener inversiones");
        }
    }

    async selectInversionById(id) {
        const conexion = DataBase.getInstance();
        try {
            const rows = await conexion.ejecutarQuery(
                "SELECT * FROM inversiones WHERE id = ? LIMIT 1",
                [id]
            );
            return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error("Error al obtener inversión");
        }
    }

    async insertInversion(concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, tipo_movimiento) {
        const conexion = DataBase.getInstance();

        try {
            return await conexion.ejecutarQuery(
                `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones, tipo_movimiento)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    concepto,
                    monto,
                    fecha_inversion,
                    categoria || "Otro",
                    fondo_origen || "reinversion",
                    observaciones || null,
                    tipo_movimiento || "inversion"
                ]
            );
        } catch (_) {
            try {
                return await conexion.ejecutarQuery(
                    `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, fondo_origen, observaciones)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        concepto,
                        monto,
                        fecha_inversion,
                        categoria || "Otro",
                        fondo_origen || "reinversion",
                        observaciones || null
                    ]
                );
            } catch (_) {
                try {
                    return await conexion.ejecutarQuery(
                        `INSERT INTO inversiones (concepto, monto, fecha_inversion, categoria, observaciones)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            concepto,
                            monto,
                            fecha_inversion,
                            categoria || "Otro",
                            observaciones || null
                        ]
                    );
                } catch (error) {
                    throw new Error("Error al crear inversión");
                }
            }
        }
    }

    async deleteInversion(id) {
        const conexion = DataBase.getInstance();
        try {
            return await conexion.ejecutarQuery(
                "DELETE FROM inversiones WHERE id = ?",
                [id]
            );
        } catch (error) {
            throw new Error("Error al eliminar inversión");
        }
    }
}
