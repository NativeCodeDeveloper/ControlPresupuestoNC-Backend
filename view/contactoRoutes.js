import {Router} from "express";
import ContactoController from "../controller/ContactoController.js";

const router = Router();


router.get('/', ContactoController.cargarDatosContacto)


export default router;