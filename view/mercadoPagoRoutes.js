import { Router } from 'express';
import {createOrder, recibirPago} from "../controller/MercadoPagoController.js";


const router = Router();


const FRONTEND = process.env.FRONT_URL;




// RUTA PARA RECONOCER LA RUTA DE PAGAR CON MERCADO PAGO DESDE EL BACKEND
router.get('/', (req, res) => {res.send("Bienvenido a pasarela de Pago")})

// RUTA PARA CREAR LA ORDEN
router.post('/create-order', createOrder);

// WEBHOOK DE ESTADO PAGADO
router.post('/notificacionPago', recibirPago);

router.get('/success', (req, res) => {
    return res.redirect(`${FRONTEND}/pagoAprobado`);
});

router.get('/failure', (req, res) => {
return res.redirect(`${FRONTEND}/pagoRechazado`);
});

router.get('/pending', (req, res) => {
 return res.redirect(`${FRONTEND}/pagoPendiente`);
});


export default router;
