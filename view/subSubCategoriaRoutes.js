import { Router } from "express";
import SubSubCategoriaProductosController from "../controller/SubSubCategoriaProductosController.js";

const router = Router();



router.post("/seleccionarPorSubSubCategoria", SubSubCategoriaProductosController.seleccionarSubSubCategoriaPorCategoria);
router.get("/seleccionarTodas", SubSubCategoriaProductosController.seleccionarSubSubCategoriasTodas);
router.post("/seleccionarPorSubSubCategoriaPorIdSubCategoria", SubSubCategoriaProductosController.seleccionarSubSubCategoriaPorIdDeSubcategoria);
router.post("/actualizarSubSubCategoria", SubSubCategoriaProductosController.actualizarSubSubCategoria);
router.post("/insertarSubSubCategoria", SubSubCategoriaProductosController.insertarSubSubCategoria);
router.post("/eliminarSubSubCategoria", SubSubCategoriaProductosController.eliminarSubSubCategoria);




export default router;