import { Router } from "express";
const router = Router();

import FinanzasController from "../controller/FinanzasController.js";

router.get("/resumen", FinanzasController.obtenerResumen);
router.get("/vencimientos", FinanzasController.obtenerVencimientos);
router.get("/flujo-caja", FinanzasController.obtenerFlujoCaja);
router.get("/f29", FinanzasController.obtenerF29);

export default router;
