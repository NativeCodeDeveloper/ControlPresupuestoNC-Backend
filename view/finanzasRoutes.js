import { Router } from "express";
const router = Router();

import FinanzasController from "../controller/FinanzasController.js";

router.get("/resumen", FinanzasController.obtenerResumen);
router.get("/vencimientos", FinanzasController.obtenerVencimientos);

export default router;
