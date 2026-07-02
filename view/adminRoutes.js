import { Router } from 'express';
import AdminController from '../controller/AdminController.js';

const router = Router();

router.param('id', (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' })
);

router.get('/servers',              AdminController.listServers);
router.post('/servers',             AdminController.createServer);
router.delete('/servers/:id',       AdminController.deleteServer);
router.get('/servers/:id/stats',    AdminController.getStats);
router.get('/servers/:id/logs',     AdminController.getLogs);
router.post('/servers/:id/exec',    AdminController.execCommand);

export default router;
