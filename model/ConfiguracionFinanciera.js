import DataBase from "../config/Database.js";

export default class ConfiguracionFinanciera {
    constructor() {}

    // OBTENER CONFIGURACIÓN FINANCIERA
    async selectConfig() {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM configuracion_financiera WHERE id = 1';
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener configuración financiera');
        }
    }

    // ACTUALIZAR CONFIGURACIÓN FINANCIERA
    async updateConfig(porcentaje_fondo_emergencia, porcentaje_reinversion) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE configuracion_financiera SET porcentaje_fondo_emergencia = ?, porcentaje_reinversion = ? WHERE id = 1';
        const param = [porcentaje_fondo_emergencia, porcentaje_reinversion];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar configuración financiera');
        }
    }
}
