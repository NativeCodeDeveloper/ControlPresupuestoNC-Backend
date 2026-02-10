import Catalogos from "../model/Catalogos.js";

export default class CatalogosController {
    constructor() {}

    // ========================================
    // TIPOS DE PROYECTOS
    // ========================================

    static async obtenerTiposProyectos(req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectTiposProyectos();
            return res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener tipos de proyectos" });
        }
    }

    static async crearTipoProyecto(req, res) {
        try {
            const { nombre, name, descripcion } = req.body;
            const nombreFinal = nombre || name;

            if (!nombreFinal) {
                return res.status(400).json({ message: "Nombre requerido" });
            }

            const catalogos = new Catalogos();
            const resultado = await catalogos.insertTipoProyecto(nombreFinal, descripcion);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear tipo de proyecto" });
        }
    }

    static async eliminarTipoProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteTipoProyecto(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar tipo de proyecto" });
        }
    }

    // ========================================
    // ESTADOS DE PROYECTOS
    // ========================================

    static async obtenerEstadosProyectos(req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectEstadosProyectos();
            return res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener estados de proyectos" });
        }
    }

    static async crearEstadoProyecto(req, res) {
        try {
            const { nombre, name, descripcion, color_hex } = req.body;
            const nombreFinal = nombre || name;

            if (!nombreFinal) {
                return res.status(400).json({ message: "Nombre requerido" });
            }

            const catalogos = new Catalogos();
            const resultado = await catalogos.insertEstadoProyecto(nombreFinal, descripcion, color_hex);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear estado de proyecto" });
        }
    }

    static async eliminarEstadoProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteEstadoProyecto(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar estado de proyecto" });
        }
    }

    // ========================================
    // TIPOS DE COSTOS VARIABLES
    // ========================================

    static async obtenerTiposCostosVariables(req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectTiposCostosVariables();
            return res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener tipos de costos variables" });
        }
    }

    static async crearTipoCostoVariable(req, res) {
        try {
            const { nombre, name, descripcion } = req.body;
            const nombreFinal = nombre || name;

            if (!nombreFinal) {
                return res.status(400).json({ message: "Nombre requerido" });
            }

            const catalogos = new Catalogos();
            const resultado = await catalogos.insertTipoCostoVariable(nombreFinal, descripcion);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear tipo de costo variable" });
        }
    }

    static async eliminarTipoCostoVariable(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteTipoCostoVariable(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar tipo de costo variable" });
        }
    }
}
