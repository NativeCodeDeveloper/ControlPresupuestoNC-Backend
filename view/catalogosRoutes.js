import { Router } from "express";
const router = Router();
import CatalogosController from "../controller/CatalogosController.js";

// ========================================
// TIPOS DE PROYECTOS
// ========================================
router.get('/tipos-proyecto', CatalogosController.obtenerTiposProyectos);
router.post('/tipos-proyecto', CatalogosController.crearTipoProyecto);
router.patch('/tipos-proyecto/:id/precio', CatalogosController.actualizarPrecioTipoProyecto);
router.delete('/tipos-proyecto/:id', CatalogosController.eliminarTipoProyecto);

// ========================================
// ESTADOS DE PROYECTOS
// ========================================
router.get('/estados-proyecto', CatalogosController.obtenerEstadosProyectos);
router.post('/estados-proyecto', CatalogosController.crearEstadoProyecto);
router.delete('/estados-proyecto/:id', CatalogosController.eliminarEstadoProyecto);

// ========================================
// SERVICIOS (redirigir al catálogo)
// ========================================
// Nota: /api/servicios ya existe como ruta independiente
// Aquí se agrega una ruta alternativa via catálogos
import ServiciosController from "../controller/ServiciosController.js";
router.get('/servicios', ServiciosController.obtenerServicios);
router.post('/servicios', ServiciosController.crearServicio);
router.delete('/servicios/:id', ServiciosController.eliminarServicio);

// ========================================
// TIPOS DE COSTOS VARIABLES
// ========================================
router.get('/tipos-costo-variable', CatalogosController.obtenerTiposCostosVariables);
router.post('/tipos-costo-variable', CatalogosController.crearTipoCostoVariable);
router.delete('/tipos-costo-variable/:id', CatalogosController.eliminarTipoCostoVariable);

export default router;
