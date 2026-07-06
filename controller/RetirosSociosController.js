import { emitUpdate } from '../config/socket.js';
import RetirosSocios from "../model/RetirosSocios.js";
import Socios from "../model/Socios.js";
import { getPartnerAvailableAmount } from "../services/financeService.js";
import { parsePagination } from "../utils/pagination.js";
import DataBase from "../config/Database.js";

/**
 * RetirosSociosController
 * Gestiona los retiros de utilidades de los socios del negocio.
 * Antes de registrar un retiro, valida que el socio exista y que el monto
 * no exceda el disponible acumulado ni el límite mensual de retiro.
 * Modelo: RetirosSocios.js, Socios.js
 * Servicio: financeService.js (para cálculo de disponible por socio)
 */
export default class RetirosSociosController {
    constructor() {}

    /**
     * obtenerDisponible - Calcula y devuelve el monto disponible para retiro de un socio.
     * Considera: acumulado histórico, retiros ya realizados en el mes y el límite mensual.
     * Ruta: GET /api/socios/:id/disponible
     * Params: id (ID del socio)
     * Query: mes, año (opcional — default período actual)
     */
    static async obtenerDisponible(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de socio requerido" });

            // Verificar que el socio exista y esté activo antes de calcular
            const socioModel = new Socios();
            const socioCheck = await socioModel.selectSocioById(id);
            if (!socioCheck) {
                return res.status(404).json({ message: "Socio no encontrado o inactivo" });
            }

            // Calcular el disponible real del socio para el período indicado en la query
            const disponible = await getPartnerAvailableAmount(id, req.query || {});
            if (!disponible) {
                return res.status(500).json({ message: "Error al calcular disponible del socio" });
            }

            return res.json(disponible);
        } catch (error) {
            console.error("[RetirosSociosController.obtenerDisponible]", error);
            return res.status(500).json({ message: "Error al obtener disponible del socio" });
        }
    }

    /**
     * obtenerRetiros - Lista todos los retiros registrados de un socio específico.
     * Ruta: GET /api/socios/:id/retiros
     * Params: id (ID del socio)
     * Query: limit, offset (paginación opcional)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerRetiros(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de socio requerido" });

            const retiros = new RetirosSocios();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataRetiros = await retiros.selectRetirosBySocio(id, pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataRetiros);
        } catch (error) {
            console.error("[RetirosSociosController.obtenerRetiros]", error);
            return res.status(500).json({ message: "Error al obtener retiros" });
        }
    }

    /**
     * registrarRetiro - Registra un retiro de utilidades para un socio.
     * Valida que:
     *   1. El socio exista y esté activo.
     *   2. El monto no supere el acumulado histórico del socio.
     *   3. El monto no supere el margen mensual restante (límite de retiro por mes).
     * Acepta nombres de campo alternativos para compatibilidad con el frontend.
     * Ruta: POST /api/socios/:id/retiros
     * Params: id (ID del socio)
     * Body: {
     *   monto | amount (number > 0, requerido),
     *   fecha_retiro | date (YYYY-MM-DD, requerido),
     *   descripcion | description (string, opcional — default "Retiro de utilidades"),
     *   numero_comprobante | receipt (string, opcional),
     *   observaciones (string, opcional)
     * }
     */
    static async registrarRetiro(req, res) {
        try {
            const { id } = req.params;
            const { monto, amount, fecha_retiro, date, descripcion, description, numero_comprobante, receipt, observaciones } = req.body;

            // Normalizar campos con nombres alternativos
            const montoFinal = Number(monto ?? amount);
            const fechaFinal = fecha_retiro || date;

            // Validar que el monto sea un número positivo y la fecha esté presente
            if (!id || !Number.isFinite(montoFinal) || montoFinal <= 0 || !fechaFinal) {
                return res.status(400).json({ message: "Faltan datos requeridos (socio_id, monto, fecha)" });
            }

            // Verificar que el socio exista y esté activo
            const socioModel = new Socios();
            const socioCheck = await socioModel.selectSocioById(id);
            if (!socioCheck) {
                return res.status(404).json({ message: "Socio no encontrado o inactivo" });
            }

            // Calcular el período del retiro desde la fecha indicada (para evaluar el límite mensual)
            const d = new Date(fechaFinal);
            const queryPeriodo = Number.isNaN(d.getTime())
                ? {}
                : { month: d.getMonth(), year: d.getFullYear() };

            // Verificar saldo e insertar dentro de una transacción atómica
            // para evitar race condition (doble retiro simultáneo del mismo socio)
            const db = DataBase.getInstance();
            const { resultado, disponibleData } = await db.withTransaction(async (conn) => {
                // Bloquear la fila del socio hasta que termine la transacción
                await conn.query('SELECT id FROM socios WHERE id = ? FOR UPDATE', [id]);

                const data = await getPartnerAvailableAmount(id, queryPeriodo);
                if (!data) throw Object.assign(new Error("Error al calcular disponible del socio"), { status: 500 });

                if (data.disponible === null || data.disponible === undefined || !Number.isFinite(Number(data.disponible))) {
                    throw Object.assign(new Error("No se pudo determinar el disponible del socio"), { status: 500 });
                }
                const disponible = Number(data.disponible);
                if (montoFinal > disponible) {
                    const acumulado = Number(data.acumulado || 0);
                    const margenMensual = Number(data.margenMensual || 0);
                    const limiteMensual = Number(data.limiteMensual || 3_000_000);
                    const retiradoMes = Number(data.retiradoMes || 0);
                    let mensaje = "Monto excede el disponible del socio";
                    if (acumulado < montoFinal) {
                        mensaje = `El socio no tiene suficiente acumulado. Disponible acumulado: $${acumulado.toLocaleString('es-CL')}`;
                    } else if (margenMensual < montoFinal) {
                        mensaje = `Límite mensual de retiro alcanzado ($${limiteMensual.toLocaleString('es-CL')}/mes). Ya retirado este mes: $${retiradoMes.toLocaleString('es-CL')}`;
                    }
                    const err = Object.assign(new Error(mensaje), {
                        status: 400, disponible, acumulado, retiradoMes, limiteMensual, margenMensual, solicitado: montoFinal, periodo: data.period
                    });
                    throw err;
                }

                const retiros = new RetirosSocios();
                const res = await retiros.insertRetiro(
                    id, montoFinal, fechaFinal,
                    descripcion || description || 'Retiro de utilidades',
                    numero_comprobante || receipt || null,
                    observaciones || null
                );
                return { resultado: res, disponibleData: data };
            });

            return res.status(201).json({
                ok: true,
                id: resultado.insertId,
                resultado,
                disponible_actualizado: Math.max(0, Number(disponibleData.disponible || 0) - montoFinal)
            });
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).json({
                    message: error.message,
                    disponible: error.disponible,
                    acumulado: error.acumulado,
                    retiradoMes: error.retiradoMes,
                    limiteMensual: error.limiteMensual,
                    margenMensual: error.margenMensual,
                    solicitado: error.solicitado,
                    periodo: error.periodo
                });
            }
            console.error("[RetirosSociosController.registrarRetiro]", error);
            return res.status(error.status || 500).json({ message: error.message || "Error al registrar retiro" });
        }
    }

    /**
     * eliminarRetiro - Realiza soft-delete de un retiro registrado.
     * affectedRows=0 indica que el retiro no existe o ya fue eliminado.
     * Ruta: DELETE /api/socios/:id/retiros/:rid
     * Params: rid (ID del retiro)
     */
    static async eliminarRetiro(req, res) {
        try {
            const { rid } = req.params;
            if (!rid) return res.status(400).json({ message: "ID de retiro requerido" });

            const retiros = new RetirosSocios();
            const resultado = await retiros.deleteRetiro(rid);
            // affectedRows=0 indica que el registro no existe o ya fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Retiro no encontrado o ya eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, success: true, softDelete: true, resultado });
        } catch (error) {
            console.error("[RetirosSociosController.eliminarRetiro]", error);
            return res.status(500).json({ message: "Error al eliminar retiro" });
        }
    }
}
