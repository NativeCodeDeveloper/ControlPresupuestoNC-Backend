import CostosFijos from "../model/CostosFijos.js";
import { parsePagination } from "../utils/pagination.js";

export default class CostosFixosController {
    constructor() {}

    // OBTENER TODOS LOS COSTOS FIJOS
    static async obtenerCostosFijos(req, res) {
        try {
            const costo = new CostosFijos();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataCostos = await costo.selectAllCostosFijos(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataCostos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costos fijos" });
        }
    }

    // OBTENER COSTOS FIJOS ACTIVOS
    static async obtenerCostosFixosActivos(req, res) {
        try {
            const costo = new CostosFijos();
            const pagination = parsePagination(req.query, { defaultLimit: 500, maxLimit: 2000 });
            const dataCostos = await costo.selectCostosFixoActivos(pagination);
            if (pagination) {
                res.set("x-pagination-limit", String(pagination.limit));
                res.set("x-pagination-offset", String(pagination.offset));
            }
            return res.json(dataCostos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costos fijos activos" });
        }
    }

    // OBTENER UN COSTO FIJO POR ID
    static async obtenerCostoFijoPorId(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }
            const costo = new CostosFijos();
            const dataCosto = await costo.selectCostoFijoById(id);
            if (!dataCosto) {
                return res.status(404).json({ message: "Costo fijo no encontrado" });
            }
            return res.json(dataCosto);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al obtener costo fijo" });
        }
    }

    // CREAR NUEVO COSTO FIJO
    static async crearCostoFijo(req, res) {
        try {
            const { servicio_id, nombre, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, notas, categoria } = req.body;

            // Si no viene servicio_id pero viene nombre/categoria, buscar o crear el servicio
            let servicioIdFinal = servicio_id;
            if (!servicioIdFinal && (nombre || categoria)) {
                const { default: Servicios } = await import("../model/Servicios.js");
                const servicioModel = new Servicios();
                const servicios = await servicioModel.selectAllServicios();
                const servicioNombre = nombre || categoria;
                const encontrado = servicios.find(s => s.nombre === servicioNombre);
                if (encontrado) {
                    servicioIdFinal = encontrado.id;
                } else {
                    const nuevoServicio = await servicioModel.insertServicio(servicioNombre, null);
                    servicioIdFinal = nuevoServicio.insertId;
                }
            }

            if (!servicioIdFinal || !monto || !frecuencia) {
                return res.status(400).json({ message: "Faltan datos requeridos (servicio, monto, frecuencia)" });
            }

            const fechaInicioFinal = fecha_inicio || new Date().toISOString().split('T')[0];

            const costo = new CostosFijos();
            const resultado = await costo.insertCostoFijo(servicioIdFinal, proveedor, monto, frecuencia, fecha_pago, fechaInicioFinal, notas);
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear costo fijo" });
        }
    }

    // ACTUALIZAR COSTO FIJO
    static async actualizarCostoFijo(req, res) {
        try {
            const { id } = req.params;
            const { servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas } = req.body;

            if (!id || !servicio_id || !monto) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const costo = new CostosFijos();
            const resultado = await costo.updateCostoFijo(id, servicio_id, proveedor, monto, frecuencia, fecha_pago, fecha_inicio, fecha_fin, notas);
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Costo fijo no encontrado o eliminado" });
            }
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al actualizar costo fijo" });
        }
    }

    // DESACTIVAR COSTO FIJO
    static async desactivarCostoFijo(req, res) {
        try {
            const { id } = req.params;
            const { fecha_fin } = req.body;

            if (!id || !fecha_fin) {
                return res.status(404).json({ message: "Faltan datos requeridos" });
            }

            const costo = new CostosFijos();
            const resultado = await costo.desactivarCostoFijo(id, fecha_fin);
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Costo fijo no encontrado o eliminado" });
            }
            return res.json({ ok: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al desactivar costo fijo" });
        }
    }

    // ELIMINAR COSTO FIJO
    static async eliminarCostoFijo(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(404).json({ message: "ID requerido" });
            }

            const costo = new CostosFijos();
            const resultado = await costo.deleteCostoFijo(id);
            if (!resultado || Number(resultado.affectedRows || 0) === 0) {
                return res.status(404).json({ message: "Costo fijo no encontrado o ya eliminado" });
            }
            return res.json({ ok: true, softDelete: true, resultado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al eliminar costo fijo" });
        }
    }
}
