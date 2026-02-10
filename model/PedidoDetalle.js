import DataBase from "../config/Database.js";

export default class PedidoDetalle {
    constructor (id_pedido , id_producto,tituloProducto, cantidad, precio_unitario) {
        this.id_pedido = id_pedido;
        this.id_producto = id_producto;
        this.tituloProducto = tituloProducto;
        this.cantidad = cantidad;
        this.precio_unitario = precio_unitario;
    }


    //FUNCION PARA INSERTAR NUEVO PEDIDO DETALLE
    async insertarPedidoDetalle(id_pedido , id_producto,tituloProducto, cantidad, precio_unitario){
        try {
            const conexion = DataBase.getInstance();
            const query = "INSERT INTO pedidoDetalle(id_pedido, id_producto,tituloProducto,cantidad, precio_unitario) VALUES (?,?,?,?,?)";
            const params = [id_pedido , id_producto,tituloProducto, cantidad, precio_unitario]
            const resultado = await conexion.ejecutarQuery(query, params);
            if(resultado){
                return resultado;
            }
        }catch (e) {
            console.error('Problema ocurrido al conectar con la base de datos a nivel de clase PedidoDetalle.js'   + e);
        }
    }





    //FUNCION PARA SELECCIONAR TODO EL DETALLE DE LOS PEDIDOS
    async seleccionarTodoDetallePedido (){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoDetalle";
            const resultado = await conexion.ejecutarQuery(query);
            if(resultado){
                return resultado;
            }
        }catch (e) {
            console.error('Problema ocurrido al conectar con la base de datos a nivel de clase PedidoDetalle.js'   + e);
        }
    }



    //METODO PARA BUSCAR PEDIDOS POR ID
    async seleccionarPedidosDetallePorID(id_pedido){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoDetalle WHERE id_pedido = ?;";
            const params = [id_pedido];

            const resultado = await conexion.ejecutarQuery(query,params );

            if(resultado){
                return resultado || [];
            }

        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoDetalle.js :  ' + e);
        }
    }
}