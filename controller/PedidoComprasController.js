import PedidoCompras from '../model/PedidoCompras.js';
import PedidoDetalle from '../model/PedidoDetalle.js';

export default class PedidoComprasController {

    static async seleccionarDetallePedido(req, res) {
        const { id_pedido } = req.body;
        if (!id_pedido) return res.status(400).send({ message: 'sindato' });
        try {
            const pedidoDetalleClase = new PedidoDetalle();
            const resultadoData = await pedidoDetalleClase.seleccionarPedidosDetallePorID(id_pedido);
            if (resultadoData) return res.json(resultadoData);
            return res.status(400).send({ message: 'sindato' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async insertarPedidoNuevo(req, res) {
        try {
            const {
                fecha_pedido, nombre_comprador, apellidosComprador, telefono_comprador,
                email_Comprador, identificacion_comprador, direccion_despacho,
                comuna, regionPais, comentarios, totalPagado, preference_id
            } = req.body;

            if (!fecha_pedido || !nombre_comprador || !apellidosComprador || !telefono_comprador ||
                !email_Comprador || !identificacion_comprador || !direccion_despacho ||
                !comuna || !regionPais || !preference_id) {
                return res.status(400).send({ message: "sindato" });
            }

            const pedidoCompra = new PedidoCompras();
            const resultado = await pedidoCompra.insertarPedidoCompra(
                fecha_pedido, nombre_comprador, apellidosComprador, telefono_comprador,
                email_Comprador, identificacion_comprador, direccion_despacho,
                comuna, regionPais, comentarios, totalPagado, preference_id
            );
            if (resultado.affectedRows > 0) return res.status(200).send({ message: "ok" });
            return res.status(400).send({ message: "nosuccess" });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async seleccionarPedidos(req, res) {
        try {
            const pedidoCompra = new PedidoCompras();
            const dataPedido = await pedidoCompra.seleccionarPedidosCompras();
            if (dataPedido) return res.json(dataPedido);
            return res.status(404).send({ message: 'sindato' });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    static async buscarPedidosPorNombre(req, res) {
        try {
            const { nombre_comprador } = req.body;
            if (!nombre_comprador) return res.status(400).send({ message: "sidato" });
            const pedidoCompra = new PedidoCompras();
            const dataPedidos = await pedidoCompra.seleccionarPedidoPorNombreComprador(nombre_comprador);
            if (dataPedidos) return res.json(dataPedidos);
        } catch (e) {
            return res.status(500).send({ error: e.message });
        }
    }

    static async buscarPedidosPorEstados(req, res) {
        try {
            const { estado_pedido } = req.body;
            if (!estado_pedido) return res.status(400).send({ message: "sidato" });
            const pedidoCompra = new PedidoCompras();
            const dataPedidos = await pedidoCompra.seleccionarPedidosPorEstado(estado_pedido);
            if (dataPedidos) return res.json(dataPedidos);
        } catch (e) {
            return res.status(500).send({ error: e.message });
        }
    }

    static async buscarPedidosPorID(req, res) {
        try {
            const { id_pedido } = req.body;
            if (!id_pedido) return res.status(400).send({ message: "sidato" });
            const pedidoCompra = new PedidoCompras();
            const dataPedidos = await pedidoCompra.seleccionarPedidosPorID(id_pedido);
            if (dataPedidos) return res.json(dataPedidos);
        } catch (e) {
            return res.status(500).send({ error: e.message });
        }
    }

    static async cambioEstadoDinamico(req, res) {
        try {
            const { estado_pedido, id_pedido } = req.body;
            if (!estado_pedido || !id_pedido) return res.status(400).send({ message: "sidato" });
            const pedidoCompra = new PedidoCompras();
            const dataPedidos = await pedidoCompra.cambioEstadoDinamico(estado_pedido, id_pedido);
            if (dataPedidos.affectedRows > 0) return res.json({ message: true });
            return res.json({ message: false });
        } catch (e) {
            return res.status(500).send({ error: e.message });
        }
    }
}
