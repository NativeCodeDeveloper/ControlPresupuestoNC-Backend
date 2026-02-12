import {
    getFinancialSummary,
    getUpcomingDueItems
} from "../services/financeService.js";

export default class FinanzasController {
    constructor() {}

    static async obtenerResumen(req, res) {
        try {
            const data = await getFinancialSummary(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Error al obtener resumen financiero" });
        }
    }

    static async obtenerVencimientos(req, res) {
        try {
            const data = await getUpcomingDueItems(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Error al obtener vencimientos" });
        }
    }
}
