import Proyectos from "../model/Proyectos.js";
import { parsePagination } from "../utils/pagination.js";
import { emitUpdate } from "../config/socket.js";

/**
 * computeAlertaPago - Calcula el estado de alerta de facturación de un proyecto.
 * Lógica:
 *   - Sin ciclo recurrente o sin fecha_proximo_pago → null (sin alerta)
 *   - > 7 días para vencer → "verde"
 *   - 0-7 días para vencer → "naranja"
 *   - Vencido (mismo día o pasado) → "rojo"
 *   - > 7 días vencido → "rojo" (la desactivación se maneja en auto-deactivate)
 */
function computeAlertaPago(proyecto) {
    if (!proyecto?.ciclo_facturacion || proyecto.ciclo_facturacion === "Unico") return null;
    if (!proyecto?.fecha_proximo_pago) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vence = new Date(proyecto.fecha_proximo_pago);
    vence.setHours(0, 0, 0, 0);

    const diffMs = vence.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 7) return "verde";
    if (diffDays >= 0) return "naranja";
    return "rojo";
}

/**
 * enrichProyectos - Agrega estado_alerta_pago y dias_para_vencer a cada proyecto.
 * También detecta proyectos con más de 7 días vencidos para auto-desactivar.
 */
async function enrichProyectos(proyectos) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return proyectos.map((p) => {
        const alerta = computeAlertaPago(p);
        let diasParaVencer = null;

        if (p.fecha_proximo_pago && p.ciclo_facturacion && p.ciclo_facturacion !== "Unico") {
            const vence = new Date(p.fecha_proximo_pago);
            vence.setHours(0, 0, 0, 0);
            diasParaVencer = Math.floor((vence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return { ...p, estado_alerta_pago: alerta, dias_para_vencer: diasParaVencer };
    });
}

/**
 * ProyectosController
 * Gestiona los proyectos del negocio: creación, seguimiento de estado,
 * registro de pagos recibidos y eliminación.
 * El código interno de cada proyecto se genera automáticamente si no se provee,
 * basándose en el tipo de proyecto y el último correlativo registrado.
 * Modelo: Proyectos.js
 */
export default class ProyectosController {
    constructor() {}

    /**
     * obtenerProyectos - Lista todos los proyectos activos.
     * Ruta: GET /api/proyectos
     * Query: limit, offset (paginación opcional, por defecto 500 registros)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerProyectos(req, res) {
        try {
            const proyecto = new Proyectos();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataProyectos = await proyecto.selectAllProyectos(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            const enriched = await enrichProyectos(dataProyectos);
            return res.json(enriched);
        } catch (error) {
            console.error("[ProyectosController.obtenerProyectos]", error);
            return res.status(500).json({ message: "Error al obtener proyectos" });
        }
    }

    /**
     * obtenerProyectoPorId - Obtiene un proyecto específico por su ID.
     * Ruta: GET /api/proyectos/:id
     * Params: id (ID del proyecto)
     */
    static async obtenerProyectoPorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const proyecto = new Proyectos();
            const dataProyecto = await proyecto.selectProyectoById(id);
            if (!dataProyecto) {
                return res.status(404).json({ message: "Proyecto no encontrado" });
            }
            const [enriched] = await enrichProyectos([dataProyecto]);
            return res.json(enriched);
        } catch (error) {
            console.error("[ProyectosController.obtenerProyectoPorId]", error);
            return res.status(500).json({ message: "Error al obtener proyecto" });
        }
    }

    /**
     * crearProyecto - Crea un nuevo proyecto con todos sus datos.
     * Si no se provee codigo_interno (o es inválido), el modelo genera el siguiente
     * correlativo automáticamente según el tipo de proyecto.
     * Ruta: POST /api/proyectos
     * Body: {
     *   nombre (string, requerido),
     *   tipo_proyecto_id (number, requerido),
     *   estado_proyecto_id (number, requerido),
     *   nombre_cliente (string, requerido),
     *   monto_acordado (number, requerido),
     *   codigo_interno (string, opcional — se genera si se omite),
     *   rut_cliente, email_cliente, telefono_cliente, profesion_cliente (opcionales),
     *   fecha_creacion (YYYY-MM-DD, opcional — default hoy),
     *   fecha_entrega (YYYY-MM-DD, opcional),
     *   observaciones (string, opcional)
     * }
     */
    static async crearProyecto(req, res) {
        try {
            const {
                codigo_interno,
                nombre,
                tipo_proyecto_id,
                estado_proyecto_id,
                nombre_cliente,
                rut_cliente,
                email_cliente,
                telefono_cliente,
                profesion_cliente,
                monto_acordado,
                fecha_creacion,
                fecha_entrega,
                observaciones,
                ciclo_facturacion,
                fecha_inicio_servicio,
                fecha_proximo_pago,
                url_cobro_mercadopago,
                direccion_cliente,
                comuna_cliente
            } = req.body;

            // Validar campos mínimos obligatorios
            if (!nombre || !tipo_proyecto_id || !estado_proyecto_id || !nombre_cliente || monto_acordado === undefined || monto_acordado === null || monto_acordado === '') {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }
            const montoNum = Number(monto_acordado);
            if (!Number.isFinite(montoNum) || montoNum < 0) {
                return res.status(400).json({ message: "monto_acordado debe ser un número válido (0 o mayor)" });
            }

            const proyecto = new Proyectos();

            // Generar codigo_interno automáticamente si no viene o excede la longitud máxima (10 chars)
            let codigoFinal = codigo_interno;
            if (!codigoFinal || codigoFinal.length > 10) {
                codigoFinal = await proyecto.getNextCodigoInterno(tipo_proyecto_id);
            }

            const { afecto_iva } = req.body;
            const resultado = await proyecto.insertProyecto(
                codigoFinal, nombre, tipo_proyecto_id, estado_proyecto_id,
                nombre_cliente, rut_cliente, email_cliente, telefono_cliente,
                profesion_cliente, monto_acordado,
                fecha_creacion || new Date().toISOString().split('T')[0],
                fecha_entrega || null, observaciones,
                ciclo_facturacion || "Unico", fecha_inicio_servicio || null, fecha_proximo_pago || null,
                url_cobro_mercadopago || null,
                afecto_iva !== undefined ? afecto_iva : 1,
                direccion_cliente || null,
                comuna_cliente || null
            );
            emitUpdate('ncf:update');
            return res.status(201).json({ ok: true, id_proyecto: resultado.insertId, codigo_interno: codigoFinal });
        } catch (error) {
            console.error("[ProyectosController.crearProyecto]", error);
            return res.status(500).json({ message: "Error al crear proyecto" });
        }
    }

    /**
     * actualizarProyecto - Actualiza los datos completos de un proyecto.
     * El código interno no se puede cambiar una vez creado.
     * Ruta: PUT /api/proyectos/:id
     * Params: id
     * Body: { nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente (requeridos), resto opcionales }
     */
    static async actualizarProyecto(req, res) {
        try {
            const { id } = req.params;
            const {
                nombre,
                tipo_proyecto_id,
                estado_proyecto_id,
                nombre_cliente,
                rut_cliente,
                email_cliente,
                telefono_cliente,
                profesion_cliente,
                monto_acordado,
                fecha_entrega,
                observaciones,
                ciclo_facturacion,
                fecha_inicio_servicio,
                fecha_proximo_pago,
                url_cobro_mercadopago,
                direccion_cliente,
                comuna_cliente
            } = req.body;

            if (!id || !nombre || !nombre_cliente) {
                return res.status(400).json({ message: "Faltan datos requeridos (nombre o cliente)" });
            }

            const proyecto = new Proyectos();

            // Si el frontend no envió estado o tipo, conservamos los valores actuales de la BD
            let estadoFinal = estado_proyecto_id || null;
            let tipoFinal   = tipo_proyecto_id   || null;
            if (!estadoFinal || !tipoFinal) {
                const actual = await proyecto.selectProyectoById(id);
                if (!estadoFinal) estadoFinal = actual?.estado_proyecto_id || actual?.id_estado_proyecto || null;
                if (!tipoFinal)   tipoFinal   = actual?.tipo_proyecto_id   || actual?.id_tipo_proyecto   || null;
            }
            if (!estadoFinal) {
                return res.status(400).json({ message: "No se pudo determinar el estado del proyecto" });
            }

            const afecto_iva = req.body.afecto_iva;
            const resultado = await proyecto.updateProyecto(
                id, nombre, tipoFinal, estadoFinal,
                nombre_cliente, rut_cliente, email_cliente, telefono_cliente,
                profesion_cliente, monto_acordado, fecha_entrega, observaciones,
                ciclo_facturacion, fecha_inicio_servicio, fecha_proximo_pago,
                url_cobro_mercadopago ?? null,
                afecto_iva !== undefined ? afecto_iva : 1,
                direccion_cliente ?? null,
                comuna_cliente ?? null
            );
            // affectedRows=0 indica que el proyecto no existe o fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Proyecto no encontrado o eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[ProyectosController.actualizarProyecto]", error);
            return res.status(500).json({ message: "Error al actualizar proyecto" });
        }
    }

    /**
     * cambiarEstadoProyecto - Actualiza únicamente el estado de un proyecto.
     * Útil para avanzar el ciclo de vida sin tocar los otros campos.
     * Ruta: PATCH /api/proyectos/:id/estado
     * Params: id
     * Body: { estado_proyecto_id (number, requerido) }
     */
    static async cambiarEstadoProyecto(req, res) {
        try {
            const { id } = req.params;
            const { estado_proyecto_id } = req.body;

            if (!id || !estado_proyecto_id) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const proyecto = new Proyectos();
            const resultado = await proyecto.updateEstadoProyecto(id, estado_proyecto_id);
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Proyecto no encontrado o eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[ProyectosController.cambiarEstadoProyecto]", error);
            return res.status(500).json({ message: "Error al cambiar estado" });
        }
    }

    /**
     * eliminarProyecto - Realiza soft-delete de un proyecto.
     * affectedRows=0 indica que ya estaba eliminado o no existe.
     * Ruta: DELETE /api/proyectos/:id
     * Params: id
     */
    static async eliminarProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const proyecto = new Proyectos();
            const resultado = await proyecto.deleteProyecto(id);
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Proyecto no encontrado o ya eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, softDelete: true, resultado });
        } catch (error) {
            console.error("[ProyectosController.eliminarProyecto]", error);
            return res.status(500).json({ message: "Error al eliminar proyecto" });
        }
    }

    /**
     * obtenerPagosProyecto - Lista todos los pagos registrados para un proyecto.
     * Los pagos representan los abonos que hace el cliente sobre el monto acordado.
     * Ruta: GET /api/proyectos/:id/pagos
     * Params: id (ID del proyecto)
     * Query: limit, offset (paginación opcional)
     */
    static async obtenerPagosProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const proyecto = new Proyectos();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataPagos = await proyecto.selectProyectoPagos(id, pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataPagos);
        } catch (error) {
            console.error("[ProyectosController.obtenerPagosProyecto]", error);
            return res.status(500).json({ message: "Error al obtener pagos" });
        }
    }

    /**
     * registrarPagoProyecto - Registra un pago recibido de un cliente para un proyecto.
     * El monto de los pagos alimenta los ingresos del resumen financiero del período.
     * Acepta nombres de campo alternativos para compatibilidad con el frontend.
     * Ruta: POST /api/proyectos/:id/pagos
     * Params: id (ID del proyecto)
     * Body: {
     *   concepto | description (string, requerido),
     *   monto | amount (number, requerido),
     *   fecha_pago | date (YYYY-MM-DD, requerido),
     *   numero_comprobante | receipt (string, opcional),
     *   notas (string, opcional)
     * }
     */
    static async registrarPagoProyecto(req, res) {
        try {
            const { id } = req.params;
            const { concepto, description, monto, amount, fecha_pago, date, numero_comprobante, receipt, notas } = req.body;

            // Normalizar campos que aceptan dos nombres (compatibilidad frontend)
            const conceptoFinal = concepto || description;
            const montoFinal = monto || amount;
            const fechaFinal = fecha_pago || date;
            const comprobanteFinal = numero_comprobante || receipt || null;

            if (!id || !conceptoFinal || !montoFinal || !fechaFinal) {
                return res.status(400).json({ message: "Faltan datos requeridos (concepto, monto, fecha)" });
            }

            const proyecto = new Proyectos();
            const resultado = await proyecto.insertProyectoPago(id, conceptoFinal, montoFinal, fechaFinal, comprobanteFinal, notas);
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[ProyectosController.registrarPagoProyecto]", error);
            return res.status(500).json({ message: "Error al registrar pago" });
        }
    }

    // PUT /api/proyectos/:id/pagos/:pagoId
    static async actualizarPagoProyecto(req, res) {
        try {
            const { pagoId } = req.params;
            const { concepto, monto, fecha_pago, numero_comprobante, notas } = req.body;
            if (!concepto || !monto || !fecha_pago) {
                return res.status(400).json({ message: "Faltan datos requeridos (concepto, monto, fecha_pago)" });
            }
            const proyecto = new Proyectos();
            const resultado = await proyecto.updateProyectoPago(pagoId, concepto, monto, fecha_pago, numero_comprobante ?? null, notas ?? null);
            emitUpdate('ncf:update');
            return res.json(resultado);
        } catch (error) {
            console.error("[ProyectosController.actualizarPagoProyecto]", error);
            return res.status(500).json({ message: "Error al actualizar pago" });
        }
    }

    // DELETE /api/proyectos/:id/pagos/:pagoId
    static async eliminarPagoProyecto(req, res) {
        try {
            const { pagoId } = req.params;
            const proyecto = new Proyectos();
            const resultado = await proyecto.deleteProyectoPago(pagoId);
            emitUpdate('ncf:update');
            return res.json(resultado);
        } catch (error) {
            console.error("[ProyectosController.eliminarPagoProyecto]", error);
            return res.status(500).json({ message: "Error al eliminar pago" });
        }
    }
}
