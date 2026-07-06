import { emitUpdate } from '../config/socket.js';
import Inversiones from "../model/Inversiones.js";
import { getFinancialSummary } from "../services/financeService.js";
import { parsePagination } from "../utils/pagination.js";
import DataBase from "../config/Database.js";

// Fondos válidos desde los que se puede originar una inversión
const FONDOS_VALIDOS = ["reinversion", "emergencia"];

// Tipos de movimiento válidos para una inversión
const MOVIMIENTOS_VALIDOS = ["inversion", "retiro"];

/**
 * InversionesController
 * Gestiona los movimientos de los fondos de reinversión y emergencia del negocio.
 * Cada inversión descuenta del fondo de origen; el sistema valida que haya saldo
 * disponible antes de registrar el movimiento.
 * Modelo: Inversiones.js
 * Servicio: financeService.js (para validar saldos de fondos)
 */
export default class InversionesController {
    constructor() {}

    /**
     * obtenerInversiones - Lista todos los movimientos de inversión registrados.
     * Ruta: GET /api/inversiones
     * Query: limit, offset (paginación opcional, por defecto 500 registros)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerInversiones(req, res) {
        try {
            const inversiones = new Inversiones();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const data = await inversiones.selectAllInversiones(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            // Asegurar que siempre se responda con un arreglo aunque el modelo retorne null
            return res.json(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("[InversionesController.obtenerInversiones]", error);
            return res.status(500).json({ message: "Error al obtener inversiones" });
        }
    }

    /**
     * crearInversion - Registra un nuevo movimiento en un fondo (reinversión o emergencia).
     * Antes de insertar, valida que el fondo tenga saldo suficiente consultando el resumen
     * financiero en tiempo real.
     * Ruta: POST /api/inversiones
     * Body: {
     *   concepto | description (string, requerido),
     *   monto | amount (number > 0, requerido),
     *   fecha_inversion | date (string YYYY-MM-DD, opcional — default hoy),
     *   categoria | category (string, default "Otro"),
     *   fondo_origen | fund ("reinversion" | "emergencia", default "reinversion"),
     *   tipo_movimiento | movement_type ("inversion" | "retiro", default "inversion"),
     *   observaciones | notes (string, opcional)
     * }
     */
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

            // Normalizar campos que aceptan dos nombres (compatibilidad frontend)
            const conceptoFinal = (concepto || description || "").trim();
            const montoFinal = Number(monto ?? amount);
            const fechaFinal = fecha_inversion || date || new Date().toISOString().split("T")[0];
            const categoriaFinal = categoria || category || "Otro";
            const fondoFinal = (fondo_origen || fund || "reinversion").toLowerCase();
            const movimientoFinal = (tipo_movimiento || movement_type || "inversion").toLowerCase();

            // Validar campos mínimos obligatorios
            if (!conceptoFinal || !Number.isFinite(montoFinal) || montoFinal <= 0) {
                return res.status(400).json({ message: "Faltan datos requeridos (concepto, monto)" });
            }

            // Validar que el fondo de origen sea uno de los permitidos
            if (!FONDOS_VALIDOS.includes(fondoFinal)) {
                return res.status(400).json({ message: "fondo_origen inválido. Use reinversion o emergencia" });
            }

            // Validar que el tipo de movimiento sea uno de los permitidos
            if (!MOVIMIENTOS_VALIDOS.includes(movimientoFinal)) {
                return res.status(400).json({ message: "tipo_movimiento inválido. Use inversion o retiro" });
            }

            // Verificar saldo e insertar dentro de una transacción atómica
            // para evitar race condition (dos inversiones simultáneas del mismo fondo)
            const db = DataBase.getInstance();
            const { resultado, created, disponibleFondo } = await db.withTransaction(async (conn) => {
                // Bloquear la tabla de inversiones para el fondo durante la transacción
                await conn.query(
                    'SELECT id FROM inversiones WHERE fondo_origen = ? LIMIT 1 FOR UPDATE',
                    [fondoFinal]
                );

                const summary = await getFinancialSummary({});
                const saldo = Number(summary?.fondos?.[fondoFinal]?.disponible || 0);

                if (montoFinal > saldo) {
                    throw Object.assign(
                        new Error(`Monto excede saldo disponible del fondo ${fondoFinal}`),
                        { status: 400, fondo_origen: fondoFinal, disponible: saldo, solicitado: montoFinal }
                    );
                }

                const inversiones = new Inversiones();
                const res = await inversiones.insertInversion(
                    conceptoFinal, montoFinal, fechaFinal,
                    categoriaFinal, fondoFinal,
                    observaciones || notes || null, movimientoFinal
                );
                const createdRec = await inversiones.selectInversionById(res.insertId);
                return { resultado: res, created: createdRec, disponibleFondo: saldo };
            });

            return res.status(201).json({
                ok: true,
                id: resultado.insertId,
                resultado,
                data: created,
                fondo_origen: fondoFinal,
                saldo_restante: Math.max(0, disponibleFondo - montoFinal)
            });
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).json({ message: error.message, fondo_origen: error.fondo_origen, disponible: error.disponible, solicitado: error.solicitado });
            }
            console.error("[InversionesController.crearInversion]", error);
            return res.status(500).json({ message: "Error al crear inversión" });
        }
    }

    /**
     * eliminarInversion - Realiza soft-delete de un movimiento de inversión.
     * El modelo maneja el soft-delete; affectedRows=0 indica que no existe o ya fue eliminado.
     * Ruta: DELETE /api/inversiones/:id
     * Params: id (ID del movimiento de inversión)
     */
    static async eliminarInversion(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "ID requerido" });
            }

            const inversiones = new Inversiones();
            const resultado = await inversiones.deleteInversion(id);
            // affectedRows=0 significa que el registro no existe o ya fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Inversión no encontrada o ya eliminada" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, success: true, softDelete: true, resultado });
        } catch (error) {
            console.error("[InversionesController.eliminarInversion]", error);
            return res.status(500).json({ message: "Error al eliminar inversión" });
        }
    }
}
