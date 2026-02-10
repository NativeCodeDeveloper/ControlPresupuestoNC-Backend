import { Router } from "express";
const router = Router();
import PublicacionController from "../controller/PublicacionesController.js";



router.post('/insertarPublicacion', PublicacionController.insertarPublicacion);
router.post('/actualizarPublicacion',PublicacionController.actualziarPublicaciones)
router.post('/eliminarPublicacion',PublicacionController.eliminarPublicacion );
router.get('/seleccionarPublicaciones', PublicacionController.seleccionarTodasPublicaciones);
router.get('/:id_publicaciones', PublicacionController.seleccionarPublicacionEspecifica);


export default router;