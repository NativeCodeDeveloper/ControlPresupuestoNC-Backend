import Servicios from "../model/Servicios.js";
import { parsePagination } from "../utils/pagination.js";

/**
 * ServiciosController
 * Gestiona el catálogo de servicios/rubros del negocio.
 * Los servicios son las categorías a las que se asocian los costos fijos
 * (ej: "Hosting", "Arriendo", "Sueldo"). CRUD completo.
 * Modelo: Servicios.js
 */
export default class ServiciosController {
    constructor() {}

    /**
     * obtenerServicios - Lista todos los servicios registrados.
     * Ruta: GET /api/servicios
     * Query: limit, offset (paginación opcional, por defecto 500 registros)
     * Headers respuesta: x-pagination-limit, x-pagination-offset
     */
    static async obtenerServicios(req, res) {
        try {
            const servicio = new Servicios();
            // Parsea parámetros de paginación opcionales desde la query string
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataServicios = await servicio.selectAllServicios(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataServicios);
        } catch (error) {
            console.error("[ServiciosController.obtenerServicios]", error);
            return res.status(500).json({ message: "Error al obtener servicios" });
        }
    }

    /**
     * obtenerServicioPorId - Obtiene un servicio específico por su ID.
     * Ruta: GET /api/servicios/:id
     * Params: id (ID del servicio)
     */
    static async obtenerServicioPorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const servicio = new Servicios();
            const dataServicio = await servicio.selectServicioById(id);
            return res.json(dataServicio);
        } catch (error) {
            console.error("[ServiciosController.obtenerServicioPorId]", error);
            return res.status(500).json({ message: "Error al obtener servicio" });
        }
    }

    /**
     * crearServicio - Crea un nuevo tipo de servicio/rubro.
     * Acepta 'nombre' o 'name' para compatibilidad con el frontend.
     * Ruta: POST /api/servicios
     * Body: { nombre | name (string, requerido), descripcion (string, opcional) }
     */
    static async crearServicio(req, res) {
        try {
            const { nombre, name, descripcion, tipo_costo_variable_id } = req.body;
            // Acepta 'nombre' o 'name' para compatibilidad con el frontend
            const nombreFinal = nombre || name;

            if (!nombreFinal) {
                return res.status(400).json({ message: "Nombre requerido" });
            }

            const servicio = new Servicios();
            const resultado = await servicio.insertServicio(nombreFinal, descripcion, tipo_costo_variable_id ?? null);
            return res.status(201).json({ ok: true, id: resultado.insertId, resultado });
        } catch (error) {
            console.error("[ServiciosController.crearServicio]", error);
            return res.status(500).json({ message: "Error al crear servicio" });
        }
    }

    /**
     * actualizarServicio - Actualiza nombre y descripción de un servicio existente.
     * Ruta: PUT /api/servicios/:id
     * Params: id
     * Body: { nombre (string, requerido), descripcion (string, opcional) }
     */
    static async actualizarServicio(req, res) {
        try {
            const { id } = req.params;
            const { nombre, descripcion, tipo_costo_variable_id } = req.body;

            if (!id || !nombre) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const servicio = new Servicios();
            const resultado = await servicio.updateServicio(id, nombre, descripcion, tipo_costo_variable_id);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[ServiciosController.actualizarServicio]", error);
            return res.status(500).json({ message: "Error al actualizar servicio" });
        }
    }

    /**
     * eliminarServicio - Elimina un servicio del catálogo.
     * Ruta: DELETE /api/servicios/:id
     * Params: id
     */
    static async eliminarServicio(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const servicio = new Servicios();
            const resultado = await servicio.deleteServicio(id);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error("[ServiciosController.eliminarServicio]", error);
            return res.status(500).json({ message: "Error al eliminar servicio" });
        }
    }
}
