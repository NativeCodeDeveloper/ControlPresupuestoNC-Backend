import { Router } from "express";
const router = Router();
import CostosVariablesController from "../controller/CostosVariablesController.js";

// GET - Obtener todos los costos variables
router.get('/', CostosVariablesController.obtenerCostosVariables);

// GET - Obtener un costo variable por ID
router.get('/:id', CostosVariablesController.obtenerCostoVariablePorId);

// GET - Obtener costos variables por tipo
router.get('/tipo/:tipo_costo_id', CostosVariablesController.obtenerCostosPorTipo);

// GET - Obtener costos variables por proyecto
router.get('/proyecto/:proyecto_id', CostosVariablesController.obtenerCostosPorProyecto);

// POST - Crear nuevo costo variable
router.post('/', CostosVariablesController.crearCostoVariable);

// PUT - Actualizar costo variable
router.put('/:id', CostosVariablesController.actualizarCostoVariable);

// DELETE - Eliminar costo variable
router.delete('/:id', CostosVariablesController.eliminarCostoVariable);

export default router;
