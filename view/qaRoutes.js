import { Router } from 'express';
import QAController from '../controller/QAController.js';

const router = Router();

// Estados (rutas estáticas antes de /estados/:id)
router.get('/estados',           QAController.listarEstados);
router.post('/estados',          QAController.crearEstado);
router.patch('/estados/reorder', QAController.reorderEstados);
router.delete('/estados/:id',    QAController.eliminarEstado);

// Tipos de caso
router.get('/tipos',           QAController.listarTipos);
router.post('/tipos',          QAController.crearTipo);
router.patch('/tipos/reorder', QAController.reorderTipos);
router.delete('/tipos/:id',    QAController.eliminarTipo);

// Prioridades
router.get('/prioridades',           QAController.listarPrioridades);
router.post('/prioridades',          QAController.crearPrioridad);
router.patch('/prioridades/reorder', QAController.reorderPrioridades);
router.delete('/prioridades/:id',    QAController.eliminarPrioridad);

// Etiquetas
router.get('/etiquetas',        QAController.listarEtiquetas);
router.post('/etiquetas',       QAController.crearEtiqueta);
router.delete('/etiquetas/:id', QAController.eliminarEtiqueta);

// Estados de versión (rutas estáticas antes de /versiones/:id para que no las capture)
router.get('/versiones/estados',           QAController.listarVersionEstados);
router.post('/versiones/estados',          QAController.crearVersionEstado);
router.patch('/versiones/estados/reorder', QAController.reorderVersionEstados);
router.delete('/versiones/estados/:id',    QAController.eliminarVersionEstado);

// Versiones
router.get('/versiones',           QAController.listarVersiones);
router.post('/versiones',          QAController.crearVersion);
router.get('/versiones/:id',       QAController.obtenerVersion);
router.put('/versiones/:id',       QAController.actualizarVersion);
router.delete('/versiones/:id',    QAController.eliminarVersion);

// Casos por versión
router.get('/versiones/:id_version/casos', QAController.listarCasos);

// Casos — CRUD + actividad
router.post('/casos',                          QAController.crearCaso);
router.get('/casos/:id',                       QAController.obtenerCaso);
router.put('/casos/:id',                       QAController.actualizarCaso);
router.delete('/casos/:id',                    QAController.eliminarCaso);
router.get('/casos/:id/actividad',             QAController.listarActividad);
router.post('/casos/:id/actividad/comentario', QAController.agregarComentario);

export default router;
