import PedidoCompras from '../model/PedidoCompras.js';
import PedidoDetalle from '../model/PedidoDetalle.js';

export default class PedidoComprasController {
    constructor() {
    }

  //METODO PARA SELECCIONAR EL DETALLE DEL PEDIDO ( SE LLAMA A LA CLASE PEDIDODETALLE)
    static async seleccionarDetallePedido(req, res){
        const { id_pedido } = req.body;

        if(!id_pedido){
            return res.status(400).send({message : 'sindato'});
        }
        try {
            const pedidoDetalleClase = new PedidoDetalle();
            const resultadoData = await pedidoDetalleClase.seleccionarPedidosDetallePorID(id_pedido);
            if(resultadoData){
                return res.json(resultadoData);
            }else {
                return res.status(400).send({message : 'sindato'});
            }

        }catch(err){
            return res.status(400).json({error: err});
        }
    }




//METODO CONTROLLER PARA INSERTAR NUEVO PEDIDO EN LA BASE DE DATOS
    static async insertarPedidoNuevo(req, res) {
        try {
            const {
                fecha_pedido,
                nombre_comprador,
                apellidosComprador,
                telefono_comprador,
                email_Comprador,
                identificacion_comprador,
                direccion_despacho,
                comuna,
                regionPais,
                comentarios,
                totalPagado,
                preference_id
            } = req.body;

            console.log("BODY PARA INGRESO DE PEDIDOS COMPRAS: ");
            console.log("---------------------------------------");
            console.log(req.body);
            console.log("---------------------------------------");

            if (!fecha_pedido || !nombre_comprador || !apellidosComprador || !telefono_comprador || !email_Comprador || !identificacion_comprador || !direccion_despacho || !comuna  || !regionPais || !preference_id) {
                return res.status(400).send({message:"sindato"});
            }else {
                const pedidoCompra = new PedidoCompras();
                const resultado = await pedidoCompra.insertarPedidoCompra(
                    fecha_pedido,
                    nombre_comprador,
                    apellidosComprador,
                    telefono_comprador,
                    email_Comprador,
                    identificacion_comprador,
                    direccion_despacho,
                    comuna,
                    regionPais,
                    comentarios,
                    totalPagado,
                    preference_id
                );
                if (resultado.affectedRows > 0) {
                    return res.status(200).send({message:"ok"});
                }else{
                    return res.status(400).send({message:"nosuccess"});
                }
            }
        }catch (e) {
            return res.status(400).json({error: e});
        }
    }


    // METODO CONTROLLER PARA SELECCIONAR TODOS LOS PEDIDOS DESDE LA BASE DE DATOS
    static async seleccionarPedidos(req, res) {
        try {
            const pedidoCompra = new PedidoCompras();
            const dataPedido =  await pedidoCompra.seleccionarPedidosCompras();
            if (dataPedido) {
                return res.json(dataPedido);
            }else{
                return res.status(400).send({error: e});
            }
        }catch (e) {
            return res.status(400).json({error: e});
        }
    }


    //METODO PARA LA BUSQUEDA POR SIMILITUD DE NOMBRES DE LOS PEDIDOS
    static async buscarPedidosPorNombre(req, res) {
        try {
            const {nombre_comprador} = req.body;
            console.log(nombre_comprador);

            if (!nombre_comprador) {
                return res.status(400).send({message:"sidato"});
            }else {
                const pedidoCompra = new PedidoCompras();
                const dataPedidos = await pedidoCompra.seleccionarPedidoPorNombreComprador(nombre_comprador);
                if (dataPedidos) {
                    return res.json(dataPedidos);
                }
            }
        }catch (e) {
            console.log('Problema detectado en la clase PedidoComprasController.js :  '+e);
            return res.status(400).send({error: e});
        }
    }





    //METODO PARA LA BUSQUEDA POR SIMILITUD DE NOMBRES DE LOS PEDIDOS
    static async buscarPedidosPorEstados(req, res) {
        try {
            const {estado_pedido} = req.body;
            if (!estado_pedido) {
                return res.status(400).send({message:"sidato"});
            }else {
                const pedidoCompra = new PedidoCompras();
                const dataPedidos = await pedidoCompra.seleccionarPedidosPorEstado(estado_pedido)
                if (dataPedidos) {
                    return res.json(dataPedidos);
                }
            }
        }catch (e) {
            console.log('Problema detectado en la clase PedidoComprasController.js :  '+e);
            return res.status(400).send({error: e});
        }
    }







    //METODO PARA LA BUSQUEDA POR ID
    static async buscarPedidosPorID(req, res) {
        try {
            const {id_pedido} = req.body;
            console.log(id_pedido);

            if (!id_pedido) {
                return res.status(400).send({message:"sidato"});
            }else {
                const pedidoCompra = new PedidoCompras();
                const dataPedidos = await pedidoCompra.seleccionarPedidosPorID(id_pedido)
                if (dataPedidos) {
                    return res.json(dataPedidos);
                }
            }
        }catch (e) {
            console.log('Problema detectado en la clase PedidoComprasController.js :  '+e);
            return res.status(400).send({error: e});
        }
    }







    //METODO PARA CAMBIAR ESTADO POR UN NUEVO ESTADO USANDO EL  ID
    static async cambioEstadoDinamico(req, res) {
        try {
            const {estado_pedido, id_pedido} = req.body;
            console.log(req.body);

            if (!estado_pedido || !id_pedido) {
                return res.status(400).send({message:"sidato"});
            }else {
                const pedidoCompra = new PedidoCompras();
                const dataPedidos = await pedidoCompra.cambioEstadoDinamico(estado_pedido, id_pedido)
                if (dataPedidos.affectedRows > 0) {
                    return res.json({message:true});
                }else {
                    return res.json({message:false});
                }
            }
        }catch (e) {
            console.log('Problema detectado en la clase PedidoComprasController.js :  '+e);
            return res.status(400).send({error: e});
        }
    }

}