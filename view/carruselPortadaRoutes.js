import { Router } from "express";
const router = Router();
import CarruselPortadaController from "../controller/CarruselPortadaController.js"



router.post('/insertarCarruselPortada', CarruselPortadaController.insertarPortadaController);
router.post('/actualizarCarruselPortada', CarruselPortadaController.editarPortadaController);
router.post('/eliminarCarruselPortada', CarruselPortadaController.eliminarPortadaController);
router.get('/seleccionarCarruselPortada', CarruselPortadaController.seleccionarPortadasController);
router.post('/seleccionarCarruselPortadaporId', CarruselPortadaController.seleccionarPortadaEspecificaIdController);




export default router;