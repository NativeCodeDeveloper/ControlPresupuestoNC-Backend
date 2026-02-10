import {Router} from "express";
import TituloController from "../controller/TituloController.js";
const router = Router();

router.get("/", TituloController.mostrarTitulo)
router.put('/', TituloController.editarTituloPrincipal)
router.put('/subtitulo', TituloController.editarSubtitulo)
router.put('/sobrenosotros', TituloController.cambiarSobreNosotros)
router.put('/proyectos', TituloController.cambiarTituloProyectos)
router.put('/contacto', TituloController.cambiarTituloContacto)




export default router;