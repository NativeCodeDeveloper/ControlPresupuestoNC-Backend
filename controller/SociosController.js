import { emitUpdate } from '../config/socket.js';
import Socios from "../model/Socios.js";
import { parsePagination } from "../utils/pagination.js";

/**
 * SociosController
 * Gestiona los socios del negocio: sus datos personales, porcentajes de participación
 * y operaciones CRUD completas.
 * El porcentaje de cada socio determina su share de las utilidades netas del período.
 * Modelo: Socios.js
 */
export default class SociosController {
    constructor() {}

    /**
     * obtenerSocios - Lista todos los socios activos del sistema.
     * Ruta: GET /api/socios
     * Query: limit, offset (paginación opcional, por defecto 500 registros)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerSocios(req, res) {
        try {
            const socio = new Socios();
            // Parsea parámetros de paginación desde query string (?limit=50&offset=0)
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataSocios = await socio.selectAllSocios(pagination);
            // Expone la paginación aplicada en headers para que el frontend pueda navegarla
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataSocios);
        } catch (error) {
            console.error("[SociosController.obtenerSocios]", error);
            return res.status(500).json({ message: "Error al obtener socios" });
        }
    }

    /**
     * obtenerSocioPorId - Obtiene un socio específico por su ID.
     * Ruta: GET /api/socios/:id
     * Params: id (ID del socio)
     */
    static async obtenerSocioPorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const socio = new Socios();
            const dataSocio = await socio.selectSocioById(id);
            return res.json(dataSocio);
        } catch (error) {
            console.error("[SociosController.obtenerSocioPorId]", error);
            return res.status(500).json({ message: "Error al obtener socio" });
        }
    }

    /**
     * crearSocio - Registra un nuevo socio con su nombre, porcentaje de participación
     * y datos de contacto opcionales.
     * Ruta: POST /api/socios
     * Body: {
     *   nombre (string, requerido),
     *   porcentaje_participacion (number, requerido),
     *   email (string, opcional),
     *   telefono (string, opcional)
     * }
     */
    static async crearSocio(req, res) {
        try {
            const { nombre, porcentaje_participacion, email, telefono } = req.body;

            // Validar campos mínimos obligatorios antes de ir a la BD
            if (!nombre || porcentaje_participacion === undefined) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }
            const pctNum = Number(porcentaje_participacion);
            if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
                return res.status(400).json({ message: "porcentaje_participacion debe ser un número entre 0 y 100" });
            }

            const socio = new Socios();
            const resultado = await socio.insertSocio(nombre, porcentaje_participacion, email, telefono);
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[SociosController.crearSocio]", error);
            return res.status(500).json({ message: "Error al crear socio" });
        }
    }

    /**
     * actualizarSocio - Actualiza todos los campos de un socio existente.
     * Ruta: PUT /api/socios/:id
     * Params: id
     * Body: {
     *   nombre (string, requerido),
     *   porcentaje_participacion (number, requerido),
     *   email (string, opcional),
     *   telefono (string, opcional)
     * }
     */
    static async actualizarSocio(req, res) {
        try {
            const { id } = req.params;
            const { nombre, porcentaje_participacion, email, telefono } = req.body;

            if (!id || !nombre || porcentaje_participacion === undefined) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const socio = new Socios();
            const resultado = await socio.updateSocio(id, nombre, porcentaje_participacion, email, telefono);
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[SociosController.actualizarSocio]", error);
            return res.status(500).json({ message: "Error al actualizar socio" });
        }
    }

    /**
     * eliminarSocio - Realiza soft-delete de un socio (lo marca como eliminado sin borrarlo físicamente).
     * affectedRows=0 indica que el registro no existe o ya estaba eliminado.
     * Ruta: DELETE /api/socios/:id
     * Params: id
     */
    static async eliminarSocio(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const socio = new Socios();
            const resultado = await socio.deleteSocio(id);
            // affectedRows=0 indica que el registro no existe o ya fue eliminado
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Socio no encontrado o ya eliminado" });
            }
            emitUpdate('ncf:update');
            return res.json({ ok: true, softDelete: true, resultado });
        } catch (error) {
            console.error("[SociosController.eliminarSocio]", error);
            return res.status(500).json({ message: "Error al eliminar socio" });
        }
    }

    /**
     * actualizarPorcentaje - Actualiza únicamente el porcentaje de participación de un socio.
     * Acepta 'porcentaje_participacion' o 'percentage' para compatibilidad con el frontend.
     * Ruta: PATCH /api/socios/:id/porcentaje
     * Params: id
     * Body: { porcentaje_participacion | percentage (number, requerido) }
     */
    static async actualizarPorcentaje(req, res) {
        try {
            const { id } = req.params;
            const { porcentaje_participacion, percentage } = req.body;
            // Acepta cualquiera de los dos nombres de campo (prioridad: porcentaje_participacion)
            const porcentajeFinal = porcentaje_participacion !== undefined ? porcentaje_participacion : percentage;

            if (!id || porcentajeFinal === undefined) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }

            const socio = new Socios();
            const resultado = await socio.updatePorcentaje(id, porcentajeFinal);
            emitUpdate('ncf:update');
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[SociosController.actualizarPorcentaje]", error);
            return res.status(500).json({ message: "Error al actualizar porcentaje" });
        }
    }
}
