import { Router } from 'express';
const router = Router();
import DteController from '../controller/DteController.js';

// Todas las rutas quedan protegidas con requireAuth por el mount en app.js (/api/dte).

router.get('/estado', DteController.estado);
router.get('/documentos', DteController.listado);
router.post('/documentos/actualizar-estados', DteController.actualizarEstados);
router.get('/proyecto/:id_proyecto', DteController.historial);
router.get('/proyecto/:id_proyecto/ultimo', DteController.ultimoDocumento);
router.post('/emitir/:id_proyecto', DteController.emitir);

export default router;
