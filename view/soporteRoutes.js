import { Router } from 'express';
import SoporteController from '../controller/SoporteController.js';

const router = Router();

// Estados
router.get('/estados', SoporteController.listarEstados);

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
