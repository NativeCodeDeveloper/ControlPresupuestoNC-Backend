import { Router } from "express";
const router = Router();
import ConfiguracionFinancieraController from "../controller/ConfiguracionFinancieraController.js";

// GET - Obtener configuración financiera
router.get('/', ConfiguracionFinancieraController.obtenerConfiguracion);

// PUT - Actualizar configuración financiera
router.put('/', ConfiguracionFinancieraController.actualizarConfiguracion);

export default router;
