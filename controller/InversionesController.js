import Inversiones from "../model/Inversiones.js";
import { getFinancialSummary } from "../services/financeService.js";

const FONDOS_VALIDOS = ["reinversion", "emergencia"];
const MOVIMIENTOS_VALIDOS = ["inversion", "retiro"];

export default class InversionesController {
    constructor() {}

    static async obtenerInversiones(req, res) {
        try {
            const inversiones = new Inversiones();
            const data = await inversiones.selectAllInversiones();
            return res.json(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Error al obtener inversiones" });
        }
    }

    static async crearInversion(req, res) {
        try {
            const {
                concepto,
                description,
                monto,
                amount,
                fecha_inversion,
                date,
                categoria,
                category,
                fondo_origen,
                fund,
                observaciones,
                notes,
                tipo_movimiento,
                movement_type
            } = req.body;

            const conceptoFinal = (concepto || description || "").trim();
            const montoFinal = Number(monto ?? amount);
            const fechaFinal = fecha_inversion || date || new Date().toISOString().split("T")[0];
            const categoriaFinal = categoria || category || "Otro";
            const fondoFinal = (fondo_origen || fund || "reinversion").toLowerCase();
            const movimientoFinal = (tipo_movimiento || movement_type || "inversion").toLowerCase();

            if (!conceptoFinal || !Number.isFinite(montoFinal) || montoFinal <= 0) {
                return res.status(400).json({ message: "Faltan datos requeridos (concepto, monto)" });
            }

            if (!FONDOS_VALIDOS.includes(fondoFinal)) {
                return res.status(400).json({ message: "fondo_origen inválido. Use reinversion o emergencia" });
            }

            if (!MOVIMIENTOS_VALIDOS.includes(movimientoFinal)) {
                return res.status(400).json({ message: "tipo_movimiento inválido. Use inversion o retiro" });
            }

            const summary = await getFinancialSummary({});
            const disponibleFondo = Number(summary?.fondos?.[fondoFinal]?.disponible || 0);

            if (montoFinal > disponibleFondo) {
                return res.status(400).json({
                    message: `Monto excede saldo disponible del fondo ${fondoFinal}`,
                    fondo_origen: fondoFinal,
                    disponible: disponibleFondo,
                    solicitado: montoFinal
                });
            }

            const inversiones = new Inversiones();
            const resultado = await inversiones.insertInversion(
                conceptoFinal,
                montoFinal,
                fechaFinal,
                categoriaFinal,
                fondoFinal,
                observaciones || notes || null,
                movimientoFinal
            );

            const created = await inversiones.selectInversionById(resultado.insertId);

            return res.json({
                ok: true,
                resultado,
                data: created,
                fondo_origen: fondoFinal,
                saldo_restante: Math.max(0, disponibleFondo - montoFinal)
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Error al crear inversión" });
        }
    }

    static async eliminarInversion(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID requerido" });
            }

            const inversiones = new Inversiones();
            const resultado = await inversiones.deleteInversion(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Error al eliminar inversión" });
        }
    }
}
