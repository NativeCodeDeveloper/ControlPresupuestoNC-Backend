import { Router } from 'express';
import CalendarioController from '../controller/CalendarioController.js';

const router = Router();

const numericId = (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' });
router.param('id', numericId);

router.get('/',                            CalendarioController.list);
router.post('/',                           CalendarioController.create);
router.put('/:id',                         CalendarioController.update);
router.delete('/:id',                      CalendarioController.remove);

// Notificaciones in-app
router.get('/notificaciones/pendientes',   CalendarioController.getNotificaciones);
router.post('/notificaciones/:id/leer',    CalendarioController.marcarLeida);
router.post('/notificaciones/leer-todas',  CalendarioController.marcarTodasLeidas);

// Push notifications
router.get('/vapid-key',                   CalendarioController.getVapidKey);
router.post('/push-subscribe',             CalendarioController.pushSubscribe);
router.delete('/push-unsubscribe',         CalendarioController.pushUnsubscribe);

router.get('/:id',                         CalendarioController.get);

export default router;
