import { Router } from "express";
import TextoController from "../controller/TextosController.js";
const router = Router();

router.get("/", TextoController.cargarTextos);
router.get("/cargarTextosTodos", TextoController.cargarTextos);
router.put("/texto1", TextoController.cambiarTexto1);
router.put("/texto2", TextoController.cambiarTexto2);

export default router;
