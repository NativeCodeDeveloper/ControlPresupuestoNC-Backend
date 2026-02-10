import DataBase from "../config/Database.js";


export default class PedidoCompras {
    constructor(id_pedido, fecha_pedido, estado_pedido, nombre_comprador, apellidosComprador, telefono_comprador, email_Comprador, identificacion_comprador, direccion_despacho, comuna , regionPais , comentarios, totalPagado, preference_id) {
        this.id_pedido = id_pedido;
        this.fecha_pedido = fecha_pedido;
        this.estado_pedido = estado_pedido;
        this.nombre_comprador = nombre_comprador;
        this.apellidosComprador = apellidosComprador;
        this.telefono_comprador = telefono_comprador;
        this.email_Comprador = email_Comprador;
        this.identificacion_comprador = identificacion_comprador;
        this.direccion_despacho = direccion_despacho;
        this.comuna = comuna;
        this.regionPais = regionPais;
        this.comentarios = comentarios;
        this.totalPagado = totalPagado;
        this.preference_id = preference_id;
    }




//METODO PARA LA INSERCION DE NUEVOS PEDIDOS EN LA BASE DE DATOS
    async insertarPedidoCompra(
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
        preference_id){

        const conexion = DataBase.getInstance();
        const query = "INSERT INTO pedidoCompras (fecha_pedido, nombre_comprador, apellidosComprador, telefono_comprador,email_Comprador, identificacion_comprador, direccion_despacho, comuna, regionPais, comentarios, totalPagado, preference_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
        const params = [fecha_pedido, nombre_comprador, apellidosComprador, telefono_comprador,email_Comprador, identificacion_comprador, direccion_despacho, comuna, regionPais, comentarios, totalPagado, preference_id];

        try {
            const resultado = await conexion.ejecutarQuery(query,params);
            console.log(resultado);
            return resultado

        }catch (e) {
            console.error("Problema a nivel de Modelo / Conflicto generado en la clase PedidoCompras.js ; ", e);
            // Propagar el error para que el controlador lo vea y pueda reaccionar (log o retry)
            throw e;
        }
    }




// METODO PARA SELECCIONAR TODOS LOS PEDIDOS
    async seleccionarPedidosCompras(){
        try {

            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoCompras";
            const resultado = await conexion.ejecutarQuery(query);

            if(resultado){
                return resultado;
            }
        }catch (e) {
            console.error('Problema ocurrido al conectar con la base de datos a nivel de clase PedidoCompras.js'   + e);
        }
    }



    //METODO PARA BUSCAR PEDIDOS POR SIMILITUD DE NOMBRE DEL COMPRADOR
    async seleccionarPedidoPorNombreComprador(nombre_comprador){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoCompras WHERE nombre_comprador LIKE ?;";
            const params = ['%' + nombre_comprador + '%' ];

            const resultado = await conexion.ejecutarQuery(query,params );

            if(resultado){
                return resultado;
            }

        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
        }
    }





    //METODO PARA BUSCAR PEDIDOS POR ESTADO
    async seleccionarPedidosPorEstado(estado_pedido){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoCompras WHERE estado_pedido = ?;";
            const params = [estado_pedido];

            const resultado = await conexion.ejecutarQuery(query,params );

            if(resultado){
                return resultado;
            }

        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
        }
    }


    async cambiarEstadoaPagado(preference_id){
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE pedidoCompras SET estado_pedido = 1  WHERE preference_id = ?";
            const params = [preference_id];
            const resultado = await conexion.ejecutarQuery(query,params );
            if(resultado) {
                return resultado;
            }else {
                return console.error('Ha habido un problema al ejecutar la consulta desde model en PedidoCompras.js , NO se ha podido cambiar el estado correctamente a pagado ')
            }
            }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
            throw e;
        }
    }

    async buscarPreferenceID_mercadoPago(preference_id){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoCompras WHERE preference_id = ?;";
            const params = [preference_id];
            const resultado = await conexion.ejecutarQuery(query,params );
            if(resultado){
                return resultado;
            }
        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
        }
    }



    //METODO PARA BUSCAR PEDIDOS POR ID
    async seleccionarPedidosPorID(id_pedido){
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM pedidoCompras WHERE id_pedido = ?;";
            const params = [id_pedido];
            const resultado = await conexion.ejecutarQuery(query,params );

            if(resultado){
                return resultado;
            }

        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
        }
    }


    // FUNCION PARA REALIZAR EL CAMBIO DE ESTADO SEGUN ID
    async cambioEstadoDinamico(estado_pedido, id_pedido){
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE pedidoCompras SET estado_pedido = ?  WHERE id_pedido = ?";
            const params = [estado_pedido, id_pedido];
            const resultado = await conexion.ejecutarQuery(query,params );
            if(resultado) {
                return resultado;
            }else {
                return console.error('Ha habido un problema al ejecutar la consulta desde model en PedidoCompras.js , NO se ha podido cambiar el estado correctamente a pagado ')
            }
        }catch (e) {
            console.log('Problema encontrado a nivel del model en PedidoCompras.js :  ' + e);
            throw e;
        }
    }
}