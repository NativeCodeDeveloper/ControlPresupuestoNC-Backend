import Servicios from "../model/Servicios.js";
import { parsePagination } from "../utils/pagination.js";

export default class ServiciosController {
    constructor() {}

    // OBTENER TODOS LOS SERVICIOS
    static async obtenerServicios(req, res) {
        try {
            const servicio = new Servicios();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataServicios = await servicio.selectAllServicios(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataServicios);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener servicios" });
        }
    }

    // OBTENER UN SERVICIO POR ID
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
            console.error(error);
            res.status(500).json({ message: "Error al obtener servicio" });
        }
    }

    // CREAR NUEVO SERVICIO
    static async crearServicio(req, res) {
        try {
            const { nombre, name, descripcion } = req.body;
            const nombreFinal = nombre || name;

            if (!nombreFinal) {
                return res.status(400).json({ message: "Nombre requerido" });
            }

            const servicio = new Servicios();
            const resultado = await servicio.insertServicio(nombreFinal, descripcion);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear servicio" });
        }
    }

    // ACTUALIZAR SERVICIO
    static async actualizarServicio(req, res) {
        try {
            const { id } = req.params;
            const { nombre, descripcion } = req.body;

            if (!id || !nombre) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const servicio = new Servicios();
            const resultado = await servicio.updateServicio(id, nombre, descripcion);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar servicio" });
        }
    }

    // ELIMINAR SERVICIO
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
            console.error(error);
            res.status(500).json({ message: "Error al eliminar servicio" });
        }
    }
}
