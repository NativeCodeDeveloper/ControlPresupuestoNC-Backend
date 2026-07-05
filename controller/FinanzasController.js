import {
    getFinancialSummary,
    getUpcomingDueItems,
    getFlujoCajaAnual,
    calcularF29
} from "../services/financeService.js";

/**
 * FinanzasController
 * Expone los endpoints de análisis financiero del sistema de control presupuestario.
 * Toda la lógica de cálculo está delegada a financeService.js; este controller
 * solo recibe la request, llama al servicio y devuelve el resultado.
 * Modelo: no usa modelos directamente, delega a financeService.js.
 */
export default class FinanzasController {
    constructor() {}

    /**
     * obtenerResumen - Devuelve el resumen financiero completo de un período.
     * Incluye: ingresos, costos fijos y variables, resultado operacional,
     * deducciones (fondo emergencia, reinversión), utilidad neta, retiros y
     * disponible por socio.
     * Ruta: GET /api/finanzas/resumen
     * Query: mes (1-12), año (ej. 2025) — si se omiten, usa el mes/año actual.
     */
    static async obtenerResumen(req, res) {
        try {
            // El servicio acepta query params para filtrar por período (mes/año)
            const data = await getFinancialSummary(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerResumen]", error);
            return res.status(500).json({ message: "Error al obtener resumen financiero" });
        }
    }

    /**
     * obtenerVencimientos - Lista los costos fijos y variables con vencimiento próximo.
     * Útil para alertar al equipo sobre pagos que se deben hacer en los próximos N días.
     * Ruta: GET /api/finanzas/vencimientos
     * Query: dias (default 7, máx 90) — ventana de días a revisar.
     */
    static async obtenerVencimientos(req, res) {
        try {
            // El servicio calcula los vencimientos dentro de la ventana de días indicada
            const data = await getUpcomingDueItems(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerVencimientos]", error);
            return res.status(500).json({ message: "Error al obtener vencimientos" });
        }
    }

    /**
     * obtenerFlujoCaja - Devuelve el flujo de caja mes a mes para un año completo.
     * Calcula ingresos, egresos reales (costos efectivos) y devengados (provisión mensual),
     * retiros, fondo de emergencia, reinversión y utilidad neta por cada mes del año.
     * Ruta: GET /api/finanzas/flujo-caja
     * Query: año (ej. 2025) — si se omite, usa el año actual.
     */
    static async obtenerFlujoCaja(req, res) {
        try {
            // El servicio itera los 12 meses del año y calcula el resultado de cada uno
            const data = await getFlujoCajaAnual(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerFlujoCaja]", error);
            return res.status(500).json({ message: "Error al obtener flujo de caja" });
        }
    }

    /**
     * obtenerF29 - Proyección del Formulario 29 para un período.
     * Ruta: GET /api/finanzas/f29
     * Query: mes (1-12), año (ej. 2025)
     */
    static async obtenerF29(req, res) {
        try {
            const data = await calcularF29(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerF29]", error);
            return res.status(500).json({ message: "Error al calcular F29" });
        }
    }
}
