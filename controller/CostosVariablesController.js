import { emitUpdate } from '../config/socket.js';
import CostosVariables from "../model/CostosVariables.js";
import { parsePagination } from "../utils/pagination.js";

/**
 * CostosVariablesController
 * Gestiona los costos variables del negocio: gastos no recurrentes y de monto variable
 * (ej: compras de materiales, honorarios puntuales, servicios externos).
 * Cada costo variable pertenece a un tipo del catálogo y puede asociarse a un proyecto.
 * Impactan directamente los egresos del período en el resumen financiero.
 * Modelo: CostosVariables.js
 */
export default class CostosVariablesController {
    constructor() {}

    /**
     * obtenerCostosVariables - Lista todos los costos variables registrados.
     * Ruta: GET /api/costos-variables
     * Query: limit, offset (paginación opcional, por defecto 500 registros)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerCostosVariables(req, res) {
        try {
            const costo = new CostosVariables();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataCostos = await costo.selectAllCostosVariables(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataCostos);
        } catch (error) {
            console.error("[CostosVariablesController.obtenerCostosVariables]", error);
            return res.status(500).json({ message: "Error al obtener costos variables" });
        }
    }

    /**
     * obtenerCostoVariablePorId - Obtiene un costo variable específico por su ID.
     * Ruta: GET /api/costos-variables/:id
     * Params: id (ID del costo variable)
     */
    static async obtenerCostoVariablePorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const costo = new CostosVariables();
            const dataCosto = await costo.selectCostoVariableById(id);
            if (!dataCosto) {
                return res.status(404).json({ message: "Costo variable no encontrado" });
            }
            return res.json(dataCosto);
        } catch (error) {
            console.error("[CostosVariablesController.obtenerCostoVariablePorId]", error);
            return res.status(500).json({ message: "Error al obtener costo variable" });
        }
    }

    /**
     * obtenerCostosPorTipo - Filtra costos variables por tipo de costo.
     * Ruta: GET /api/costos-variables/tipo/:tipo_costo_id
     * Params: tipo_costo_id (ID del tipo de costo del catálogo)
     * Query: limit, offset (paginación opcional)
     */
    static async obtenerCostosPorTipo(req, res) {
        try {
            const { tipo_costo_id } = req.params;
            if (!tipo_costo_id) {
                return res.status(404).json({ message: "Tipo requerido" });
            }
            const costo = new CostosVariables();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataCostos = await costo.selectCostosPorTipo(tipo_costo_id, pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataCostos);
        } catch (error) {
            console.error("[CostosVariablesController.obtenerCostosPorTipo]", error);
            return res.status(500).json({ message: "Error al obtener costos por tipo" });
        }
    }

    /**
     * obtenerCostosPorProyecto - Filtra costos variables asociados a un proyecto.
     * Permite ver qué costos variables impactan a un proyecto específico.
     * Ruta: GET /api/costos-variables/proyecto/:proyecto_id
     * Params: proyecto_id (ID del proyecto)
     * Query: limit, offset (paginación opcional)
     */
    static async obtenerCostosPorProyecto(req, res) {
        try {
            const { proyecto_id } = req.params;
            if (!proyecto_id) {
                return res.status(404).json({ message: "Proyecto requerido" });
            }
            const costo = new CostosVariables();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataCostos = await costo.selectCostosPorProyecto(proyecto_id, pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataCostos);
        } catch (error) {
            console.error("[CostosVariablesController.obtenerCostosPorProyecto]", error);
            return res.status(500).json({ message: "Error al obtener costos por proyecto" });
        }
    }

    /**
     * crearCostoVariable - Registra un nuevo costo variable.
     * Si no se provee tipo_costo_id pero sí tipo (nombre), busca el tipo por nombre
     * y lo crea automáticamente si no existe (upsert de tipo de costo).
     * Ruta: POST /api/costos-variables
     * Body: {
     *   tipo_costo_id (number, requerido si no viene tipo),
     *   tipo (string, alternativa a tipo_costo_id — busca/crea el tipo),
     *   concepto (string, opcional — default = tipo o "Costo variable"),
     *   monto (number, requerido),
     *   fecha (YYYY-MM-DD, requerido),
     *   fecha_vencimiento (YYYY-MM-DD, opcional),
     *   proyecto_id (number, opcional — para asociar a un proyecto),
     *   comprobante_url (string, opcional),
     *   observaciones (string, opcional)
     * }
     */
    static async crearCostoVariable(req, res) {
        try {
            const { tipo_costo_id, tipo, concepto, monto, fecha, fecha_vencimiento, proyecto_id, comprobante_url, observaciones, con_factura } = req.body;

            // Si no viene tipo_costo_id pero sí el nombre del tipo, buscar o crear el tipo dinámicamente
            let tipoCostoIdFinal = tipo_costo_id;
            if (!tipoCostoIdFinal && tipo) {
                // Import dinámico para evitar dependencia circular con Catalogos
                const { default: Catalogos } = await import("../model/Catalogos.js");
                const catalogos = new Catalogos();
                const tipos = await catalogos.selectTiposCostosVariables();
                const encontrado = tipos.find(t => t.nombre === tipo);
                if (encontrado) {
                    // Reutilizar el tipo existente
                    tipoCostoIdFinal = encontrado.id;
                } else {
                    // Crear el tipo nuevo y usar su ID
                    const nuevoTipo = await catalogos.insertTipoCostoVariable(tipo, null);
                    tipoCostoIdFinal = nuevoTipo.insertId;
                }
            }

            // Derivar el concepto del tipo si no se provee explícitamente
            const conceptoFinal = concepto || tipo || 'Costo variable';

            if (!tipoCostoIdFinal || !monto || !fecha) {
                return res.status(400).json({ message: "Faltan datos requeridos (tipo, monto, fecha)" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.insertCostoVariable(
                tipoCostoIdFinal,
                conceptoFinal,
                monto,
                fecha,
                fecha_vencimiento || null,
                proyecto_id || null,
                comprobante_url,
                observaciones,
                con_factura !== undefined ? con_factura : 1
            );
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[CostosVariablesController.crearCostoVariable]", error);
            return res.status(500).json({ message: "Error al crear costo variable" });
        }
    }

    /**
     * actualizarCostoVariable - Actualiza todos los campos de un costo variable.
     * Ruta: PUT /api/costos-variables/:id
     * Params: id
     * Body: { tipo_costo_id, concepto, monto (requeridos), fecha, fecha_vencimiento,
     *         proyecto_id, comprobante_url, observaciones (opcionales) }
     */
    static async actualizarCostoVariable(req, res) {
        try {
            const { id } = req.params;
            const { tipo_costo_id, concepto, monto, fecha, fecha_vencimiento, proyecto_id, comprobante_url, observaciones, con_factura } = req.body;

            if (!id || !tipo_costo_id || !concepto || !monto) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.updateCostoVariable(
                id,
                tipo_costo_id,
                concepto,
                monto,
                fecha,
                fecha_vencimiento || null,
                proyecto_id,
                comprobante_url,
                observaciones,
                con_factura !== undefined ? con_factura : 1
            );
            // affectedRows=0 indica que el registro no existe o fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Costo variable no encontrado o eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[CostosVariablesController.actualizarCostoVariable]", error);
            return res.status(500).json({ message: "Error al actualizar costo variable" });
        }
    }

    /**
     * eliminarCostoVariable - Realiza soft-delete de un costo variable.
     * affectedRows=0 indica que ya estaba eliminado o no existe.
     * Ruta: DELETE /api/costos-variables/:id
     * Params: id
     */
    static async eliminarCostoVariable(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.deleteCostoVariable(id);
            // affectedRows=0 indica que el registro no existe o ya fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Costo variable no encontrado o ya eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, softDelete: true, resultado });
        } catch (error) {
            console.error("[CostosVariablesController.eliminarCostoVariable]", error);
            return res.status(500).json({ message: "Error al eliminar costo variable" });
        }
    }
}
