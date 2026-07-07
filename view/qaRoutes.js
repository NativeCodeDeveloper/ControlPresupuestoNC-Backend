import { Router } from 'express';
import QAController from '../controller/QAController.js';

const router = Router();

// Estados
router.get('/estados',          QAController.listarEstados);
router.post('/estados',         QAController.crearEstado);
router.delete('/estados/:id',   QAController.eliminarEstado);

// Etiquetas
router.get('/etiquetas',        QAController.listarEtiquetas);
router.post('/etiquetas',       QAController.crearEtiqueta);
router.delete('/etiquetas/:id', QAController.eliminarEtiqueta);

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
