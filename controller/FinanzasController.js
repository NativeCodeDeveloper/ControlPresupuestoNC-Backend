import {
    getFinancialSummary,
    getUpcomingDueItems,
    getFlujoCajaAnual,
    calcularF29
} from "../services/financeService.js";
import { emitUpdate } from "../config/socket.js";
import * as F29Pagos from "../model/F29Pagos.js";

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
            const mes = req.query.mes !== undefined ? Number(req.query.mes) : undefined;
            const año = req.query.año !== undefined ? Number(req.query.año) : undefined;
            if (mes !== undefined && (Number.isNaN(mes) || mes < 1 || mes > 12)) {
                return res.status(400).json({ message: 'Parámetro mes inválido (1-12)' });
            }
            if (año !== undefined && (Number.isNaN(año) || año < 2000 || año > 2100)) {
                return res.status(400).json({ message: 'Parámetro año inválido' });
            }
            const data = await calcularF29(req.query || {});
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerF29]", error);
            return res.status(500).json({ message: "Error al calcular F29" });
        }
    }

    /**
     * obtenerHistorialF29 - Últimos N períodos de F29 con su estado (pagado/pendiente).
     * Los períodos ya marcados como pagados devuelven el snapshot guardado al momento
     * de pagar; los pendientes se calculan en vivo.
     * Ruta: GET /api/finanzas/f29/historial
     * Query: meses (opcional, default 12, máx 36)
     */
    static async obtenerHistorialF29(req, res) {
        try {
            const meses = Math.min(36, Math.max(1, Number(req.query.meses) || 12));
            const data = await F29Pagos.getHistorial(meses);
            return res.json(data);
        } catch (error) {
            console.error("[FinanzasController.obtenerHistorialF29]", error);
            return res.status(500).json({ message: "Error al obtener historial F29" });
        }
    }

    /**
     * marcarPagadoF29 - Marca un período F29 como pagado, guardando un snapshot
     * del cálculo actual (débito, crédito, IVA neto, PPM).
     * Ruta: POST /api/finanzas/f29/marcar-pagado
     * Body: { mes (1-12, requerido), anio (requerido), fecha_pago (opcional), notas (opcional) }
     */
    static async marcarPagadoF29(req, res) {
        try {
            const mes = Number(req.body?.mes);
            const anio = Number(req.body?.anio);
            if (!Number.isFinite(mes) || mes < 1 || mes > 12 || !Number.isFinite(anio)) {
                return res.status(400).json({ message: "mes (1-12) y anio son requeridos" });
            }
            const resultado = await F29Pagos.marcarPagado({ mes, anio, fecha_pago: req.body?.fecha_pago, notas: req.body?.notas });
            emitUpdate('ncf:update');
            return res.status(201).json({ ok: true, resultado });
        } catch (error) {
            console.error("[FinanzasController.marcarPagadoF29]", error);
            return res.status(500).json({ message: "Error al marcar F29 como pagado" });
        }
    }

    /**
     * desmarcarPagadoF29 - Revierte la marca de pagado de un período F29 (por error).
     * Ruta: DELETE /api/finanzas/f29/marcar-pagado/:anio/:mes
     */
    static async desmarcarPagadoF29(req, res) {
        try {
            const { anio, mes } = req.params;
            await F29Pagos.desmarcarPagado(Number(mes), Number(anio));
            emitUpdate('ncf:update');
            return res.json({ ok: true });
        } catch (error) {
            console.error("[FinanzasController.desmarcarPagadoF29]", error);
            return res.status(500).json({ message: "Error al desmarcar F29" });
        }
    }
}
