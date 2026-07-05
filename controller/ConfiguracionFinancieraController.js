import ConfiguracionFinanciera from "../model/ConfiguracionFinanciera.js";

/**
 * ConfiguracionFinancieraController
 * Gestiona la configuración global del modelo financiero del negocio.
 * Controla los porcentajes que se deducen automáticamente de las utilidades
 * netas para alimentar el fondo de emergencia y el fondo de reinversión.
 * Modelo: ConfiguracionFinanciera.js
 */
export default class ConfiguracionFinancieraController {
    constructor() {}

    /**
     * obtenerConfiguracion - Devuelve la configuración financiera activa.
     * Incluye los porcentajes de fondo de emergencia y reinversión que se aplican
     * al resultado operacional para calcular la distribución de utilidades.
     * Ruta: GET /api/config/financiera
     */
    static async obtenerConfiguracion(_req, res) {
        try {
            const config = new ConfiguracionFinanciera();
            // Lee la fila de configuración única (ID=1 por convención del modelo)
            const dataConfig = await config.selectConfig();
            return res.json(dataConfig);
        } catch (error) {
            console.error("[ConfiguracionFinancieraController.obtenerConfiguracion]", error);
            return res.status(500).json({ message: "Error al obtener configuración financiera" });
        }
    }

    /**
     * actualizarConfiguracion - Actualiza los porcentajes de deducción automática.
     * Ambos porcentajes deben estar entre 0 y 100. El impacto es inmediato:
     * todos los cálculos del resumen financiero usarán los nuevos valores.
     * Ruta: PUT /api/config/financiera
     * Body: {
     *   porcentaje_fondo_emergencia (number, 0-100, requerido),
     *   porcentaje_reinversion (number, 0-100, requerido)
     * }
     */
    static async actualizarConfiguracion(req, res) {
        try {
            const { porcentaje_fondo_emergencia, porcentaje_reinversion, tasa_ppm } = req.body;

            // Validar que ambos campos estén presentes
            if (porcentaje_fondo_emergencia === undefined || porcentaje_reinversion === undefined) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }

            const emergencia = Number(porcentaje_fondo_emergencia);
            const reinversion = Number(porcentaje_reinversion);
            const ppm = tasa_ppm !== undefined ? Number(tasa_ppm) : 1;

            // Validar que sean números finitos (no NaN, no Infinity)
            if (!Number.isFinite(emergencia) || !Number.isFinite(reinversion)) {
                return res.status(400).json({ message: "Porcentajes inválidos" });
            }

            // Validar rango permitido 0-100 para cada porcentaje
            if (emergencia < 0 || emergencia > 100 || reinversion < 0 || reinversion > 100) {
                return res.status(400).json({ message: "Porcentajes fuera de rango (0-100)" });
            }

            const config = new ConfiguracionFinanciera();
            const resultado = await config.updateConfig(emergencia, reinversion, ppm);

            // Leer la configuración actualizada para retornarla al frontend inmediatamente
            const data = await config.selectConfig();
            return res.json({ ok: true, resultado, data });
        } catch (error) {
            console.error("[ConfiguracionFinancieraController.actualizarConfiguracion]", error);
            return res.status(500).json({ message: "Error al actualizar configuración financiera" });
        }
    }
}
