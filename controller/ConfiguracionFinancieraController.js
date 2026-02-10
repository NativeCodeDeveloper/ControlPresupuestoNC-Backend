import ConfiguracionFinanciera from "../model/ConfiguracionFinanciera.js";

export default class ConfiguracionFinancieraController {
    constructor() {}

    // OBTENER CONFIGURACIÓN
    static async obtenerConfiguracion(req, res) {
        try {
            const config = new ConfiguracionFinanciera();
            const dataConfig = await config.selectConfig();
            return res.json(dataConfig);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener configuración financiera" });
        }
    }

    // ACTUALIZAR CONFIGURACIÓN
    static async actualizarConfiguracion(req, res) {
        try {
            const { porcentaje_fondo_emergencia, porcentaje_reinversion } = req.body;

            if (porcentaje_fondo_emergencia === undefined || porcentaje_reinversion === undefined) {
                return res.status(400).json({ message: "Faltan datos requeridos" });
            }

            const config = new ConfiguracionFinanciera();
            const resultado = await config.updateConfig(porcentaje_fondo_emergencia, porcentaje_reinversion);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar configuración financiera" });
        }
    }
}
