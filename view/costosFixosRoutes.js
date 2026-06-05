import { Router } from "express";
const router = Router();
import CostosFixosController from "../controller/CostosFixosController.js";

// GET - Obtener todos los costos fijos
router.get('/', CostosFixosController.obtenerCostosFijos);

// GET - Obtener costos fijos activos
router.get('/activos', CostosFixosController.obtenerCostosFixosActivos);

// GET - Obtener un costo fijo por ID
router.get('/:id', CostosFixosController.obtenerCostoFijoPorId);

// POST - Crear nuevo costo fijo
router.post('/', CostosFixosController.crearCostoFijo);

// PUT - Actualizar costo fijo
router.put('/:id', CostosFixosController.actualizarCostoFijo);

// PATCH - Registrar pago (avanza fecha_ultimo_pago y el recordatorio de vencimiento)
router.patch('/:id/pagar', CostosFixosController.registrarPago);

// PATCH - Desactivar costo fijo
router.patch('/:id/desactivar', CostosFixosController.desactivarCostoFijo);

// DELETE - Eliminar costo fijo
router.delete('/:id', CostosFixosController.eliminarCostoFijo);

export default router;
