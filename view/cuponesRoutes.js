import cuponeController from "../controller/CuponesController.js";
import {Router} from "express";
const router = Router();

router.get("/seleccionarCupones", cuponeController.seleccionarCupones);
router.post("/seleccionarCuponesId", cuponeController.seleccionarCuponEspecificoPorID);
router.post("/seleccionarCuponesCodigo", cuponeController.seleccionarCuponCodigo);
router.post("/insertarCupon", cuponeController.insertarCupon);
router.post("/actualizarCupon", cuponeController.atualizarCupon);
router.post("/eliminarCupon", cuponeController.elimnarCupon);



export default router;
