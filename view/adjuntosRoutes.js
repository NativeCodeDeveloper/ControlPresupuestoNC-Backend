import { Router } from 'express';
import AdjuntosController from '../controller/AdjuntosController.js';
import { upload } from '../config/uploadConfig.js';

const router = Router();

router.param('id', (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' })
);

// Subir archivo: POST /api/adjuntos  body: { entidad, id_entidad } + file
router.post('/',                        upload.single('file'), AdjuntosController.upload);

// Descargar: GET /api/adjuntos/file/:id  — DEBE ir antes de /:entidad/:id
router.get('/file/:id',                 AdjuntosController.download);

// Listar adjuntos de una entidad: GET /api/adjuntos/:entidad/:id
router.get('/:entidad/:id',             AdjuntosController.list);

// Eliminar: DELETE /api/adjuntos/:id
router.delete('/:id',                   AdjuntosController.remove);

export default router;
