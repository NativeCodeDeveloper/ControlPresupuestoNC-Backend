import { Router } from "express";
const router = Router();

import InversionesController from "../controller/InversionesController.js";

router.get("/", InversionesController.obtenerInversiones);
router.post("/", InversionesController.crearInversion);
router.delete("/:id", InversionesController.eliminarInversion);

export default router;
