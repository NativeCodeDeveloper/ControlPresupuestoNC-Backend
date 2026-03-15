import Textos from "../model/Textos.js";

/**
 * TextosController
 * Gestiona los textos estáticos configurables del sitio web (secciones "Sobre Nosotros",
 * descripciones, etc.) que se editan desde el panel administrativo.
 * Modelo asociado: Textos.js
 */
export default class TextosController {
    constructor() {}

    /**
     * getTextos - Carga todos los textos desde la base de datos.
     * Ruta: GET /textos
     * Respuesta: arreglo con todos los registros de textos, o [] si no hay ninguno.
     */
    static async getTextos(_req, res) {
        try {
            // Instanciar el modelo con nombre distinto al import para evitar conflicto de scope
            const textosModel = new Textos();
            const textosRes = await textosModel.cargarTextos();
            // Si no hay registros, responder con arreglo vacío (no 404)
            return res.status(200).json(textosRes ?? []);
        } catch (error) {
            console.error("[TextosController.getTextos]", error);
            return res.status(500).json({ error: "Error al cargar datos desde controller" });
        }
    }

    /**
     * cargarTextos - Alias de getTextos, mantenido por compatibilidad con rutas antiguas.
     * Ruta: GET /textos/cargar (o equivalente según las rutas configuradas)
     */
    static async cargarTextos(_req, res) {
        try {
            const textosModel = new Textos();
            const textosRes = await textosModel.cargarTextos();
            return res.json(textosRes ?? []);
        } catch (error) {
            // Capturar el error y responder 500; sin este return la request quedaría colgada
            console.error("[TextosController.cargarTextos]", error);
            return res.status(500).json({ error: "Error al cargar datos desde controller" });
        }
    }

    /**
     * cambiarTexto1 - Actualiza el primer campo de texto configurable del sitio.
     * Ruta: PUT /textos/texto1
     * Body: { texto1: string }
     */
    static async cambiarTexto1(req, res) {
        const { texto1 } = req.body;

        // Validar que el campo requerido esté presente antes de ir a la BD
        if (!texto1) {
            return res.status(400).json({ message: "El campo texto1 es requerido" });
        }

        try {
            const textos = new Textos();
            const resultado = await textos.updateTexto1(texto1);
            return res.json({ message: "Texto 1 actualizado correctamente", resultado });
        } catch (error) {
            console.error("[TextosController.cambiarTexto1]", error);
            return res.status(500).json({ message: "Error al realizar la consulta a la base de datos" });
        }
    }

    /**
     * cambiarTexto2 - Actualiza el segundo campo de texto configurable del sitio.
     * Ruta: PUT /textos/texto2
     * Body: { texto2: string }
     */
    static async cambiarTexto2(req, res) {
        const { texto2 } = req.body;

        // Validar que el campo requerido esté presente antes de ir a la BD
        if (!texto2) {
            return res.status(400).json({ message: "El campo texto2 es requerido" });
        }

        try {
            const textos = new Textos();
            const resultado = await textos.updateTexto2(texto2);
            return res.json({ message: "Texto 2 actualizado correctamente", resultado });
        } catch (error) {
            console.error("[TextosController.cambiarTexto2]", error);
            return res.status(500).json({ message: "Error al realizar la consulta a la base de datos" });
        }
    }
}
