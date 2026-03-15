import Catalogos from "../model/Catalogos.js";

/**
 * CatalogosController
 * Gestiona los catálogos de datos maestros usados en el sistema de control presupuestario:
 *   - Tipos de proyecto (ej: "Desarrollo Web", "Diseño", "Consultoría")
 *   - Estados de proyecto (ej: "En progreso", "Pausado", "Cerrado")
 *   - Tipos de costos variables (ej: "Materiales", "Comisiones", "Transporte")
 * Modelo: Catalogos.js
 */
export default class CatalogosController {
    constructor() {}

    // ========================================
    // TIPOS DE PROYECTOS
    // ========================================

    /**
     * obtenerTiposProyectos - Lista todos los tipos de proyecto disponibles.
     * Ruta: GET /api/catalogos/tipos-proyectos
     */
    static async obtenerTiposProyectos(_req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectTiposProyectos();
            return res.json(data);
        } catch (error) {
            console.error("[CatalogosController.obtenerTiposProyectos]", error);
            return res.status(500).json({ message: "Error al obtener tipos de proyectos" });
        }
    }

    /**
     * crearTipoProyecto - Crea un nuevo tipo de proyecto.
     * Acepta 'nombre' o 'name' para compatibilidad con el frontend.
     * Ruta: POST /api/catalogos/tipos-proyectos
     * Body: { nombre | name (string, requerido), descripcion (string, opcional) }
     */
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
            console.error("[CatalogosController.crearTipoProyecto]", error);
            return res.status(500).json({ message: "Error al crear tipo de proyecto" });
        }
    }

    /**
     * eliminarTipoProyecto - Elimina un tipo de proyecto del catálogo.
     * Ruta: DELETE /api/catalogos/tipos-proyectos/:id
     * Params: id
     */
    static async eliminarTipoProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteTipoProyecto(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error("[CatalogosController.eliminarTipoProyecto]", error);
            return res.status(500).json({ message: "Error al eliminar tipo de proyecto" });
        }
    }

    // ========================================
    // ESTADOS DE PROYECTOS
    // ========================================

    /**
     * obtenerEstadosProyectos - Lista todos los estados posibles de un proyecto.
     * Ruta: GET /api/catalogos/estados-proyectos
     */
    static async obtenerEstadosProyectos(_req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectEstadosProyectos();
            return res.json(data);
        } catch (error) {
            console.error("[CatalogosController.obtenerEstadosProyectos]", error);
            return res.status(500).json({ message: "Error al obtener estados de proyectos" });
        }
    }

    /**
     * crearEstadoProyecto - Crea un nuevo estado de proyecto con color opcional.
     * Acepta 'nombre' o 'name' para compatibilidad con el frontend.
     * Ruta: POST /api/catalogos/estados-proyectos
     * Body: {
     *   nombre | name (string, requerido),
     *   descripcion (string, opcional),
     *   color_hex (string, opcional, ej: "#FF5733")
     * }
     */
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
            console.error("[CatalogosController.crearEstadoProyecto]", error);
            return res.status(500).json({ message: "Error al crear estado de proyecto" });
        }
    }

    /**
     * eliminarEstadoProyecto - Elimina un estado de proyecto del catálogo.
     * Ruta: DELETE /api/catalogos/estados-proyectos/:id
     * Params: id
     */
    static async eliminarEstadoProyecto(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteEstadoProyecto(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error("[CatalogosController.eliminarEstadoProyecto]", error);
            return res.status(500).json({ message: "Error al eliminar estado de proyecto" });
        }
    }

    // ========================================
    // TIPOS DE COSTOS VARIABLES
    // ========================================

    /**
     * obtenerTiposCostosVariables - Lista todos los tipos de costo variable disponibles.
     * También se expone como GET /api/tipos-costos (ruta alternativa en app.js).
     * Ruta: GET /api/catalogos/tipos-costos-variables
     */
    static async obtenerTiposCostosVariables(_req, res) {
        try {
            const catalogos = new Catalogos();
            const data = await catalogos.selectTiposCostosVariables();
            return res.json(data);
        } catch (error) {
            console.error("[CatalogosController.obtenerTiposCostosVariables]", error);
            return res.status(500).json({ message: "Error al obtener tipos de costos variables" });
        }
    }

    /**
     * crearTipoCostoVariable - Crea un nuevo tipo de costo variable en el catálogo.
     * Acepta 'nombre' o 'name' para compatibilidad con el frontend.
     * También se expone como POST /api/tipos-costos (ruta alternativa en app.js).
     * Ruta: POST /api/catalogos/tipos-costos-variables
     * Body: { nombre | name (string, requerido), descripcion (string, opcional) }
     */
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
            console.error("[CatalogosController.crearTipoCostoVariable]", error);
            return res.status(500).json({ message: "Error al crear tipo de costo variable" });
        }
    }

    /**
     * eliminarTipoCostoVariable - Elimina un tipo de costo variable del catálogo.
     * También se expone como DELETE /api/tipos-costos/:id (ruta alternativa en app.js).
     * Ruta: DELETE /api/catalogos/tipos-costos-variables/:id
     * Params: id
     */
    static async eliminarTipoCostoVariable(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID requerido" });

            const catalogos = new Catalogos();
            const resultado = await catalogos.deleteTipoCostoVariable(id);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error("[CatalogosController.eliminarTipoCostoVariable]", error);
            return res.status(500).json({ message: "Error al eliminar tipo de costo variable" });
        }
    }
}
