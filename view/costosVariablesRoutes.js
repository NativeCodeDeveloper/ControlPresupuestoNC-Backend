import { Router } from "express";
const router = Router();
import CostosVariablesController from "../controller/CostosVariablesController.js";

// GET - Obtener todos los costos variables
router.get('/', CostosVariablesController.obtenerCostosVariables);

// GET - Obtener costos variables por tipo (rutas específicas ANTES de /:id)
router.get('/tipo/:tipo_costo_id', CostosVariablesController.obtenerCostosPorTipo);

// GET - Obtener costos variables por proyecto
router.get('/proyecto/:proyecto_id', CostosVariablesController.obtenerCostosPorProyecto);

// GET - Obtener un costo variable por ID (genérico va AL FINAL)
router.get('/:id', CostosVariablesController.obtenerCostoVariablePorId);

// POST - Crear nuevo costo variable
router.post('/', CostosVariablesController.crearCostoVariable);

// PUT - Actualizar costo variable
router.put('/:id', CostosVariablesController.actualizarCostoVariable);

// DELETE - Eliminar costo variable
router.delete('/:id', CostosVariablesController.eliminarCostoVariable);

export default router;
