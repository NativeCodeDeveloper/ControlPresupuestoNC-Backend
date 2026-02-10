import { Router } from "express";
import subCategoriaController from "../controller/SubCategoriaController.js";

const router = Router();


router.get("/seleccionarSubCategoria", subCategoriaController.seleccionarSubCategoriasTodas );
router.post("/seleccionarPorCategoria", subCategoriaController.seleccionarSubCategoriaPorCategoria );
router.post("/seleccionarSubCategoriaid", subCategoriaController.seleccionarSubCategoriaPorId );
router.post("/actualizarSubCategoria", subCategoriaController.actualizarSubcategoria );
router.post("/insertarSubCategoria", subCategoriaController.insertarSubCategoria );
router.post("/eliminarSubCategoria", subCategoriaController.eliminarSubCategoria );


export default router;