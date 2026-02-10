import { Router } from "express";
const router = Router();
import ServiciosController from "../controller/ServiciosController.js";

// GET - Obtener todos los servicios
router.get('/', ServiciosController.obtenerServicios);

// GET - Obtener un servicio por ID
router.get('/:id', ServiciosController.obtenerServicioPorId);

// POST - Crear nuevo servicio
router.post('/', ServiciosController.crearServicio);

// PUT - Actualizar servicio
router.put('/:id', ServiciosController.actualizarServicio);

// DELETE - Eliminar servicio
router.delete('/:id', ServiciosController.eliminarServicio);

export default router;
