import CostosVariables from "../model/CostosVariables.js";

export default class CostosVariablesController {
    constructor() {}

    // OBTENER TODOS LOS COSTOS VARIABLES
    static async obtenerCostosVariables(req, res) {
        try {
            const costo = new CostosVariables();
            const dataCostos = await costo.selectAllCostosVariables();
            return res.json(dataCostos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costos variables" });
        }
    }

    // OBTENER UN COSTO VARIABLE POR ID
    static async obtenerCostoVariablePorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const costo = new CostosVariables();
            const dataCosto = await costo.selectCostoVariableById(id);
            return res.json(dataCosto);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costo variable" });
        }
    }

    // OBTENER COSTOS VARIABLES POR TIPO
    static async obtenerCostosPorTipo(req, res) {
        try {
            const { tipo_costo_id } = req.params;
            if (!tipo_costo_id) {
                return res.status(404).json({ message: "Tipo requerido" });
            }
            const costo = new CostosVariables();
            const dataCostos = await costo.selectCostosPorTipo(tipo_costo_id);
            return res.json(dataCostos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costos por tipo" });
        }
    }

    // OBTENER COSTOS VARIABLES POR PROYECTO
    static async obtenerCostosPorProyecto(req, res) {
        try {
            const { proyecto_id } = req.params;
            if (!proyecto_id) {
                return res.status(404).json({ message: "Proyecto requerido" });
            }
            const costo = new CostosVariables();
            const dataCostos = await costo.selectCostosPorProyecto(proyecto_id);
            return res.json(dataCostos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costos por proyecto" });
        }
    }

    // CREAR NUEVO COSTO VARIABLE
    static async crearCostoVariable(req, res) {
        try {
            const { tipo_costo_id, tipo, concepto, monto, fecha, proyecto_id, comprobante_url, observaciones } = req.body;

            // Si no viene tipo_costo_id pero viene tipo (nombre), buscar o crear el tipo
            let tipoCostoIdFinal = tipo_costo_id;
            if (!tipoCostoIdFinal && tipo) {
                const { default: Catalogos } = await import("../model/Catalogos.js");
                const catalogos = new Catalogos();
                const tipos = await catalogos.selectTiposCostosVariables();
                const encontrado = tipos.find(t => t.nombre === tipo);
                if (encontrado) {
                    tipoCostoIdFinal = encontrado.id;
                } else {
                    const nuevoTipo = await catalogos.insertTipoCostoVariable(tipo, null);
                    tipoCostoIdFinal = nuevoTipo.insertId;
                }
            }

            const conceptoFinal = concepto || tipo || 'Costo variable';

            if (!tipoCostoIdFinal || !monto || !fecha) {
                return res.status(400).json({ message: "Faltan datos requeridos (tipo, monto, fecha)" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.insertCostoVariable(tipoCostoIdFinal, conceptoFinal, monto, fecha, proyecto_id || null, comprobante_url, observaciones);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear costo variable" });
        }
    }

    // ACTUALIZAR COSTO VARIABLE
    static async actualizarCostoVariable(req, res) {
        try {
            const { id } = req.params;
            const { tipo_costo_id, concepto, monto, fecha, proyecto_id, comprobante_url, observaciones } = req.body;

            if (!id || !tipo_costo_id || !concepto || !monto) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.updateCostoVariable(id, tipo_costo_id, concepto, monto, fecha, proyecto_id, comprobante_url, observaciones);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar costo variable" });
        }
    }

    // ELIMINAR COSTO VARIABLE
    static async eliminarCostoVariable(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const costo = new CostosVariables();
            const resultado = await costo.deleteCostoVariable(id);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar costo variable" });
        }
    }
}
