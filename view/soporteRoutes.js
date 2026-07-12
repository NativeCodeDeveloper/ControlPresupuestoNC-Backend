import { Router } from 'express';
import SoporteController from '../controller/SoporteController.js';
import ActualizacionesController from '../controller/ActualizacionesController.js';

const router = Router();

// Estados (rutas estáticas primero)
router.get('/estados',          SoporteController.listarEstados);
router.post('/estados',         SoporteController.crearEstado);
router.patch('/estados/reorder', SoporteController.reorderEstados);
router.delete('/estados/:id',   SoporteController.eliminarEstado);

// Actualizaciones — estados (antes de /actualizaciones para evitar shadowing)
router.get('/actualizaciones/estados',        ActualizacionesController.listarEstados);
router.post('/actualizaciones/estados',       ActualizacionesController.crearEstado);
router.delete('/actualizaciones/estados/:id', ActualizacionesController.eliminarEstado);

// Actualizaciones — CRUD + acciones (estáticas antes de /:id)
router.get('/actualizaciones',                    ActualizacionesController.listar);
router.post('/actualizaciones',                   ActualizacionesController.crear);
router.post('/actualizaciones/enviar',            ActualizacionesController.enviar);
router.get('/actualizaciones/:id',                ActualizacionesController.obtener);
router.put('/actualizaciones/:id',                ActualizacionesController.actualizar);
router.delete('/actualizaciones/:id',             ActualizacionesController.eliminar);
router.post('/actualizaciones/:id/notificar',     ActualizacionesController.notificar);

// Tickets
router.get('/',          SoporteController.listar);
router.get('/:id',       SoporteController.obtener);
router.post('/',         SoporteController.crear);
router.put('/:id',       SoporteController.actualizar);
router.delete('/:id',    SoporteController.eliminar);

// Actividad interna
router.get('/:id/actividad',              SoporteController.listarActividad);
router.post('/:id/actividad/comentario',  SoporteController.agregarComentario);

// Email
router.get('/:id/email/preview',   SoporteController.previewEmail);
router.post('/:id/email/enviar',   SoporteController.enviarEmail);

export default router;
