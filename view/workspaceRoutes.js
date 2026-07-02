import { Router } from 'express';
import WorkspaceController from '../controller/WorkspaceController.js';

const router = Router();

router.param('id', (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' })
);

router.get('/',        WorkspaceController.getIniciativas);
router.get('/:id',     WorkspaceController.getIniciativa);
router.post('/',       WorkspaceController.createIniciativa);
router.put('/:id',     WorkspaceController.updateIniciativa);
router.delete('/:id',  WorkspaceController.deleteIniciativa);

export default router;
