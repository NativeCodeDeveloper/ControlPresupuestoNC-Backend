import { Router } from "express";
import ProyectosController from "../controller/ProyectosController.js";

const router = Router();

router.param('id', (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' })
);

// GET - Obtener todos los proyectos
router.get('/', ProyectosController.obtenerProyectos);

// GET - Obtener un proyecto por ID
router.get('/:id', ProyectosController.obtenerProyectoPorId);

// POST - Crear nuevo proyecto
router.post('/', ProyectosController.crearProyecto);

// PUT - Actualizar proyecto
router.put('/:id', ProyectosController.actualizarProyecto);

// PATCH - Cambiar estado del proyecto
router.patch('/:id/estado', ProyectosController.cambiarEstadoProyecto);

// DELETE - Eliminar proyecto
router.delete('/:id', ProyectosController.eliminarProyecto);

// GET - Obtener pagos de un proyecto
router.get('/:id/pagos', ProyectosController.obtenerPagosProyecto);

// POST - Registrar pago de proyecto
router.post('/:id/pagos', ProyectosController.registrarPagoProyecto);

export default router;
