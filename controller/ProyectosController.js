import Proyectos from "../model/Proyectos.js";
import { parsePagination } from "../utils/pagination.js";

export default class ProyectosController {
    constructor() {}

    // OBTENER TODOS LOS PROYECTOS
    static async obtenerProyectos(req, res) {
        try {
            const proyecto = new Proyectos();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataProyectos = await proyecto.selectAllProyectos(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataProyectos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener proyectos" });
        }
    }

    // OBTENER UN PROYECTO POR ID
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
            return res.json(dataProyecto);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener proyecto" });
        }
    }

    // CREAR NUEVO PROYECTO (genera codigo_interno automáticamente)
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
                observaciones
            } = req.body;

            if (!nombre || !tipo_proyecto_id || !estado_proyecto_id || !nombre_cliente || !monto_acordado) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }

            const proyecto = new Proyectos();

            // Generar codigo_interno automáticamente si no viene o es inválido
            let codigoFinal = codigo_interno;
            if (!codigoFinal || codigoFinal.length > 10) {
                codigoFinal = await proyecto.getNextCodigoInterno(tipo_proyecto_id);
            }

            const resultado = await proyecto.insertProyecto(
                codigoFinal,
                nombre,
                tipo_proyecto_id,
                estado_proyecto_id,
                nombre_cliente,
                rut_cliente,
                email_cliente,
                telefono_cliente,
                profesion_cliente,
                monto_acordado,
                fecha_creacion || new Date().toISOString().split('T')[0],
                fecha_entrega || null,
                observaciones
            );
            return res.json({ ok: true, resultado, codigo_interno: codigoFinal });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear proyecto" });
        }
    }

    // ACTUALIZAR PROYECTO
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
                observaciones
            } = req.body;

            if (!id || !nombre || !nombre_cliente) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const proyecto = new Proyectos();
            const resultado = await proyecto.updateProyecto(
                id,
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
                observaciones
            );
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Proyecto no encontrado o eliminado" });
            }
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar proyecto" });
        }
    }

    // CAMBIAR ESTADO DEL PROYECTO
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
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al cambiar estado" });
        }
    }

    // ELIMINAR PROYECTO
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
            return res.json({ ok: true, softDelete: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar proyecto" });
        }
    }

    // OBTENER PAGOS DE UN PROYECTO
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
            console.error(error);
            res.status(500).json({ message: "Error al obtener pagos" });
        }
    }

    // REGISTRAR PAGO DE PROYECTO
    static async registrarPagoProyecto(req, res) {
        try {
            const { id } = req.params;
            const { concepto, description, monto, amount, fecha_pago, date, numero_comprobante, receipt, notas } = req.body;

            const conceptoFinal = concepto || description;
            const montoFinal = monto || amount;
            const fechaFinal = fecha_pago || date;
            const comprobanteFinal = numero_comprobante || receipt || null;

            if (!id || !conceptoFinal || !montoFinal || !fechaFinal) {
                return res.status(400).json({ message: "Faltan datos requeridos (concepto, monto, fecha)" });
            }

            const proyecto = new Proyectos();
            const resultado = await proyecto.insertProyectoPago(id, conceptoFinal, montoFinal, fechaFinal, comprobanteFinal, notas);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al registrar pago" });
        }
    }
}
