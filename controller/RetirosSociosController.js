import RetirosSocios from "../model/RetirosSocios.js";
import { getPartnerAvailableAmount } from "../services/financeService.js";

export default class RetirosSociosController {
    constructor() {}

    // DISPONIBLE DE UN SOCIO EN EL PERIODO
    static async obtenerDisponible(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de socio requerido" });

            const disponible = await getPartnerAvailableAmount(id, req.query || {});
            if (!disponible) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            return res.json(disponible);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener disponible del socio" });
        }
    }

    // OBTENER RETIROS DE UN SOCIO
    static async obtenerRetiros(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de socio requerido" });

            const retiros = new RetirosSocios();
            const dataRetiros = await retiros.selectRetirosBySocio(id);
            return res.json(dataRetiros);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener retiros" });
        }
    }

    // REGISTRAR RETIRO
    static async registrarRetiro(req, res) {
        try {
            const { id } = req.params;
            const { monto, amount, fecha_retiro, date, descripcion, description, numero_comprobante, receipt, observaciones } = req.body;

            const montoFinal = Number(monto ?? amount);
            const fechaFinal = fecha_retiro || date;

            if (!id || !Number.isFinite(montoFinal) || montoFinal <= 0 || !fechaFinal) {
                return res.status(400).json({ message: "Faltan datos requeridos (socio_id, monto, fecha)" });
            }

            const d = new Date(fechaFinal);
            const queryPeriodo = Number.isNaN(d.getTime())
                ? {}
                : { month: d.getMonth(), year: d.getFullYear() };

            const disponibleData = await getPartnerAvailableAmount(id, queryPeriodo);
            if (!disponibleData) {
                return res.status(404).json({ message: "Socio no encontrado" });
            }

            if (montoFinal > Number(disponibleData.disponible || 0)) {
                return res.status(400).json({
                    message: "Monto excede disponible del socio en el período",
                    disponible: Number(disponibleData.disponible || 0),
                    solicitado: montoFinal,
                    periodo: disponibleData.period
                });
            }

            const retiros = new RetirosSocios();
            const resultado = await retiros.insertRetiro(
                id,
                montoFinal,
                fechaFinal,
                descripcion || description || 'Retiro de utilidades',
                numero_comprobante || receipt || null,
                observaciones || null
            );
            return res.json({
                ok: true,
                resultado,
                disponible_actualizado: Math.max(0, Number(disponibleData.disponible || 0) - montoFinal)
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al registrar retiro" });
        }
    }

    // ELIMINAR RETIRO
    static async eliminarRetiro(req, res) {
        try {
            const { rid } = req.params;
            if (!rid) return res.status(400).json({ message: "ID de retiro requerido" });

            const retiros = new RetirosSocios();
            const resultado = await retiros.deleteRetiro(rid);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar retiro" });
        }
    }
}
