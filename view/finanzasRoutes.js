import { Router } from "express";
const router = Router();

import FinanzasController from "../controller/FinanzasController.js";

router.get("/resumen", FinanzasController.obtenerResumen);
router.get("/vencimientos", FinanzasController.obtenerVencimientos);
router.get("/flujo-caja", FinanzasController.obtenerFlujoCaja);
router.get("/f29", FinanzasController.obtenerF29);
router.get("/f29/historial", FinanzasController.obtenerHistorialF29);
router.post("/f29/marcar-pagado", FinanzasController.marcarPagadoF29);
router.delete("/f29/marcar-pagado/:anio/:mes", FinanzasController.desmarcarPagadoF29);

export default router;
