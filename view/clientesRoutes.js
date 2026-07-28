import { Router } from 'express';
import ClienteController from '../controller/ClienteController.js';
import BovedaController  from '../controller/BovedaController.js';
import MetricasController from '../controller/MetricasController.js';

const router = Router();

// ── CRM ───────────────────────────────────────────────────────────────────────
router.get('/',                          ClienteController.listar);
router.get('/metricas',                  MetricasController.resumen);
router.get('/:nombre/proyectos',         ClienteController.proyectos);

// ── Bóveda — entradas ─────────────────────────────────────────────────────────
router.get('/boveda',                    BovedaController.listar);
router.post('/boveda',                   BovedaController.crear);
router.get('/boveda/proyecto/:id_proyecto', BovedaController.obtenerPorProyecto);
router.get('/boveda/:id',                BovedaController.obtener);
router.put('/boveda/:id',                BovedaController.actualizar);

// ── Bóveda — env vars ─────────────────────────────────────────────────────────
router.get('/boveda/:id/env',            BovedaController.listarEnv);
router.post('/boveda/:id/env',           BovedaController.crearEnv);
router.put('/boveda/:id/env/:envId',     BovedaController.actualizarEnv);
router.delete('/boveda/:id/env/:envId',  BovedaController.eliminarEnv);

// ── Bóveda — accesos ──────────────────────────────────────────────────────────
router.get('/boveda/:id/accesos',        BovedaController.listarAccesos);
router.post('/boveda/:id/accesos',       BovedaController.crearAcceso);
router.put('/boveda/:id/accesos/:accId', BovedaController.actualizarAcceso);
router.delete('/boveda/:id/accesos/:accId', BovedaController.eliminarAcceso);

export default router;
