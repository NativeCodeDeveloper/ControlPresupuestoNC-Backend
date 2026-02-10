import DataBase from "../config/Database.js";

export default class EspecificacionProducto{

    constructor(id_EspecificacionProducto, descripcionEspecificacion, estadoEspecificacion, id_subsubcategoria) {
        this.id_EspecificacionProducto = id_EspecificacionProducto;
        this.descripcionEspecificacion = descripcionEspecificacion;
        this.estadoEspecificacion = estadoEspecificacion;
        this.id_subsubcategoria = id_subsubcategoria;
    }


    // SELECCION DE TODAS LAS ESPECIFICACIONES DIFERENTES DE CERO (ESTADO DE ELIMINADO LOGICO)
    async seleccionarTodasEspecificaciones(){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM especificacionProducto WHERE estadoEspecificacion <> 0;';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }



    // INSERCION DE NUEVA ESPECIFICACION EN LA BASE DE DATOS
    async insertarNuevaEspecificacion(descripcionEspecificacion, id_subsubcategoria){
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO especificacionProducto (descripcionEspecificacion, id_subsubcategoria) VALUES (?, ?)';
        const param = [descripcionEspecificacion, id_subsubcategoria];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logro ingresar Especificacion nueva / Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }




    // SELECCIONAR LA ESPECIFICACION ESPECIFICA POR ID
    async seleccionarEspecificacionEspecifica(id_EspecificacionProducto){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM especificacionProducto where id_EspecificacionProducto = ?';
        const param = [id_EspecificacionProducto];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(resultado){
                return resultado[0];
            }

        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }



    // ELIMINACION LOGICA DE ESPECIFICACION
    async eliminarEspecificacion(id_EspecificacionProducto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE especificacionProducto SET estadoEspecificacion = 0 where id_EspecificacionProducto = ?';
        const param = [id_EspecificacionProducto];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;

            }
        } catch (error) {
            throw new Error('NO se logro eliminar Especificacion / Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }





// ACTUALIZACION DE ESPECIFICACION EN LA BASE DE DATOS
    async actualizarEspecificacion(descripcionEspecificacion, id_subsubcategoria, id_EspecificacionProducto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE especificacionProducto SET descripcionEspecificacion = ?, id_subsubcategoria = ? where id_EspecificacionProducto = ? ';
        const param = [descripcionEspecificacion, id_subsubcategoria, id_EspecificacionProducto];

        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;

            }
        } catch (error) {
            throw new Error('NO se logro actualizar Especificacion mediante id_EspecificacionProducto en base de datos / Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }




    // SELECCIONAR LA ESPECIFICACION ESPECIFICA POR ID DE SUBSUBCATEGORIA
    async seleccionarEspecificacionEspecificaPorIdSubSubCategoria(id_subsubcategoria){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM especificacionProducto where id_subsubcategoria = ? AND estadoEspecificacion <> 0';
        const param = [id_subsubcategoria];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;

        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase EspecificacionProducto.js')

        }
    }


}