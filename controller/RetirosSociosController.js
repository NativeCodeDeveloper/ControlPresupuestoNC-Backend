import RetirosSocios from "../model/RetirosSocios.js";

export default class RetirosSociosController {
    constructor() {}

    // OBTENER RETIROS DE UN SOCIO
    static async obtenerRetiros(req, res) {
        try {
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "ID de socio requerido" });

            const retiros = new RetirosSocios();
            const dataRetiros = await retiros.selectRetirosBySocio(id);
            return res.json(dataRetiros);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener retiros" });
        }
    }

    // REGISTRAR RETIRO
    static async registrarRetiro(req, res) {
        try {
            const { id } = req.params;
            const { monto, amount, fecha_retiro, date, descripcion, description, numero_comprobante, receipt, observaciones } = req.body;

            const montoFinal = monto || amount;
            const fechaFinal = fecha_retiro || date;

            if (!id || !montoFinal || !fechaFinal) {
                return res.status(400).json({ message: "Faltan datos requeridos (socio_id, monto, fecha)" });
            }

            const retiros = new RetirosSocios();
            const resultado = await retiros.insertRetiro(
                id,
                montoFinal,
                fechaFinal,
                descripcion || description || 'Retiro de utilidades',
                numero_comprobante || receipt || null,
                observaciones || null
            );
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al registrar retiro" });
        }
    }

    // ELIMINAR RETIRO
    static async eliminarRetiro(req, res) {
        try {
            const { rid } = req.params;
            if (!rid) return res.status(400).json({ message: "ID de retiro requerido" });

            const retiros = new RetirosSocios();
            const resultado = await retiros.deleteRetiro(rid);
            return res.json({ ok: true, success: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar retiro" });
        }
    }
}
