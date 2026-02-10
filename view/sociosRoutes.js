import { Router } from "express";
const router = Router();
import SociosController from "../controller/SociosController.js";

// GET - Obtener todos los socios
router.get('/', SociosController.obtenerSocios);

// GET - Obtener un socio por ID
router.get('/:id', SociosController.obtenerSocioPorId);

// POST - Crear nuevo socio
router.post('/', SociosController.crearSocio);

// PUT - Actualizar socio
router.put('/:id', SociosController.actualizarSocio);

// PATCH - Actualizar porcentaje
router.patch('/:id/porcentaje', SociosController.actualizarPorcentaje);

// DELETE - Eliminar socio
router.delete('/:id', SociosController.eliminarSocio);

export default router;
