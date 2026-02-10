import Socios from "../model/Socios.js";

export default class SociosController {
    constructor() {}

    // OBTENER TODOS LOS SOCIOS
    static async obtenerSocios(req, res) {
        try {
            const socio = new Socios();
            const dataSocios = await socio.selectAllSocios();
            return res.json(dataSocios);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener socios" });
        }
    }

    // OBTENER UN SOCIO POR ID
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
            console.error(error);
            res.status(500).json({ message: "Error al obtener socio" });
        }
    }

    // CREAR NUEVO SOCIO
    static async crearSocio(req, res) {
        try {
            const { nombre, porcentaje_participacion, email, telefono } = req.body;

            if (!nombre || porcentaje_participacion === undefined) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const socio = new Socios();
            const resultado = await socio.insertSocio(nombre, porcentaje_participacion, email, telefono);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear socio" });
        }
    }

    // ACTUALIZAR SOCIO
    static async actualizarSocio(req, res) {
        try {
            const { id } = req.params;
            const { nombre, porcentaje_participacion, email, telefono } = req.body;

            if (!id || !nombre || porcentaje_participacion === undefined) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const socio = new Socios();
            const resultado = await socio.updateSocio(id, nombre, porcentaje_participacion, email, telefono);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar socio" });
        }
    }

    // ELIMINAR SOCIO
    static async eliminarSocio(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const socio = new Socios();
            const resultado = await socio.deleteSocio(id);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar socio" });
        }
    }

    // ACTUALIZAR PORCENTAJE
    static async actualizarPorcentaje(req, res) {
        try {
            const { id } = req.params;
            const { porcentaje_participacion, percentage } = req.body;
            const porcentajeFinal = porcentaje_participacion !== undefined ? porcentaje_participacion : percentage;

            if (!id || porcentajeFinal === undefined) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }

            const socio = new Socios();
            const resultado = await socio.updatePorcentaje(id, porcentajeFinal);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar porcentaje" });
        }
    }
}
