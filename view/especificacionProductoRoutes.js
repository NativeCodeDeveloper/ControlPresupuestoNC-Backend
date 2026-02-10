import { Router } from "express";
const router = Router();
import EspecificacionProductoController from "../controller/EspecificacionProductoController.js";


router.post('/seleccionarEspecificacionPorId', EspecificacionProductoController.seleccionarEspecificacionEspecificaController);
router.post('/insertarEspecificacion', EspecificacionProductoController.insertarEspecificacion);
router.post('/actualizarEspecificacion', EspecificacionProductoController.actualizarEspecificacion);
router.post('/eliminarEspecificacion', EspecificacionProductoController.eliminarEspecificacion);
router.get('/seleccionarEspecificacion', EspecificacionProductoController.seleccionarTodasEspecificaciones);
router.post('/seleccionarEspecificacionUnica', EspecificacionProductoController.seleccionarEspecificacionEspecificaController);
router.post('/seleccionarEspecificacionPorSubSubCategoria', EspecificacionProductoController.seleccionarEspecificacionEspecificaPorIdSubSubCategoriaCotroller);





export default router;