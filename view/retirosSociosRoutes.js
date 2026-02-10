import { Router } from "express";
const router = Router();
import RetirosSociosController from "../controller/RetirosSociosController.js";

// GET - Obtener retiros de un socio
router.get('/:id/retiros', RetirosSociosController.obtenerRetiros);

// POST - Registrar retiro de un socio
router.post('/:id/retiros', RetirosSociosController.registrarRetiro);

// DELETE - Eliminar retiro
router.delete('/:id/retiros/:rid', RetirosSociosController.eliminarRetiro);

export default router;
