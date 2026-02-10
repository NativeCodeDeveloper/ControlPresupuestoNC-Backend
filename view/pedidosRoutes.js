import { Router } from 'express';
const router = Router();
import PedidoComprasController from "../controller/PedidoComprasController.js";

router.post("/ingresarNuevoPedido", PedidoComprasController.insertarPedidoNuevo);
router.get("/seleccionarPedidos", PedidoComprasController.seleccionarPedidos);
router.post("/seleccionarPorComprador", PedidoComprasController.buscarPedidosPorNombre);
router.post("/seleccionarPorEstados", PedidoComprasController.buscarPedidosPorEstados);
router.post("/seleccionarPorid", PedidoComprasController.buscarPedidosPorID);
router.post("/seleccionarDetalle", PedidoComprasController.seleccionarDetallePedido);
router.post("/cambioEstado", PedidoComprasController.cambioEstadoDinamico);



export default router;