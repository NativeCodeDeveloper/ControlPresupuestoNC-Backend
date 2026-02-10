import { Router } from "express";
const router = Router();
import CategoriaController from "../controller/CategoriasController.js"



router.post('/insertarCategoria', CategoriaController.insertarCategoria);
router.post('/actualizarCategoria', CategoriaController.actualizarCategoria);
router.post('/eliminarCategoria', CategoriaController.eliminarCategoria);
router.get('/seleccionarCategoria', CategoriaController.seleccionarTodasCategorias);
router.get('/:id_categoriaProducto', CategoriaController.seleccionCategoriasPorId);





export default router;