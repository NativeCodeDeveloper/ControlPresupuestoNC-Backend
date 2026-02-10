import { Router } from "express";
const router = Router();
import ProductoController from "../controller/ProductoController.js";


router.post('/buscarSimilar', ProductoController.seleccionarProductoSimilar);
router.post('/insertarProducto', ProductoController.insertarProducto);
router.post('/seleccionarPorSubcategoria', ProductoController.seleccionarProductoSubcategoria);
router.post('/seleccionarPorSubSubcategoria', ProductoController.seleccionarProductoSubSubcategoria);
router.post('/actualizarProducto', ProductoController.actualizarProducto);
router.post('/actualizarStock', ProductoController.actualizarStock);
router.post('/eliminarProducto', ProductoController.eliminarProducto);
router.post('/marcarOferta', ProductoController.marcarProductoComoOferta);
router.post('/marcarNormal', ProductoController.marcarProductoNormal);
router.get('/seleccionarProducto', ProductoController.seleccionarTodosProductos);
router.get('/seleccionarProductoReciente', ProductoController.seleccionarProductosRecientes);
router.get('/seleccionarOfertas', ProductoController.seleccionarTodosProductosOferta);
router.post('/categoriaProducto', ProductoController.seleccionarProductoCategoria);
router.get('/ordenarMayor', ProductoController.seleccionarTodosProductosMayorPrecio);
router.get('/ordenarMenor', ProductoController.seleccionarTodosProductosMenorPrecio);
router.get('/:id_producto', ProductoController.seleccionarProductoEspecifico);




export default router;