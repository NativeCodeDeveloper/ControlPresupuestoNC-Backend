import {Router} from "express";
import FichaClinicaController from "../controller/FichaClinicaController.js";

const router = Router();

router.get("/seleccionarTodasLasFichas", FichaClinicaController.seleccionarTodasFichas);
router.post("/seleccionarFichaID", FichaClinicaController.seleccionarFichaID);
router.post("/seleccionarFichasPaciente", FichaClinicaController.seleccionarFichasPaciente);
router.post("/editarFichaPaciente", FichaClinicaController.editarFichaPaciente);
router.post("/insertarFichaClinica", FichaClinicaController.insertarNuevaFichaPaciente);
router.post("/eliminarFichaClinica", FichaClinicaController.eliminarFicha);
router.post("/seleccionarFichaEspecificaPorId", FichaClinicaController.seleccionarFichaPacientePorIDdeFicha);


export default router;
