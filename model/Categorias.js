import DataBase from "../config/Database.js";

export default class Categorias{

    constructor(id_categoriaProducto, descripcionCategoria,estadoCategoria) {
        this._id_categoriaProducto = id_categoriaProducto;
        this._descripcionCategoria = descripcionCategoria;
        this._estadoCategoria = estadoCategoria;
    }


    get id_categoriaProducto() {
        return this._id_categoriaProducto;
    }

    set id_categoriaProducto(value) {
        this._id_categoriaProducto = value;
    }

    get descripcionCategoria() {
        return this._descripcionCategoria;
    }

    set descripcionCategoria(value) {
        this._descripcionCategoria = value;
    }

    get estadoCategoria() {
        return this._estadoCategoria;
    }

    set estadoCategoria(value) {
        this._estadoCategoria = value;
    }



    // SELECCION DE TODAS LAS CATEGORIAS DIFERENTES DE CERO LA CUAL ES EL ESTADO DE ELIMINADO LOGICO DE LA CATEGORIA
    async seleccionarTodasCategorias(){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM categoriaProductos WHERE estadoCategoria <> 0;';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Categorias.js')

        }
    }



    // INSERCION DE NUEVA CATEGORIA EN LA BASE DE DATOS
    async insertarNuevaCategoria(descripcionCategoria){
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO categoriaProductos (descripcionCategoria) VALUES (?)';
        const param = [descripcionCategoria];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logo ingresar Categoria nueva / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')

        }
    }




    // SELECCIONAR LA CATEGORIA ESPECIFICA POR ID DE CATEGORIA
    async seleccionarCategoriaEspecifica(id_categoriaProducto){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM categoriaProductos where id_categoriaProducto = ?';
        const param = [id_categoriaProducto];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(resultado){
                return resultado[0];
            }

        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }



   // ELIMINACION LOGICA DE CATEGORIA
    async eliminarCategoria(id_categoriaProducto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE categoriaProductos SET estadoCategoria = 0 where id_categoriaProducto = ?';
        const param = [id_categoriaProducto];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;

            }
        } catch (error) {
            throw new Error('NO se logo eliminar Categoria Producto  / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')

        }
    }






// ACTUALIZACION DE CATEGORIAS EN LA BASE DE DATOS
    async actualizarCategoria(descripcionCategoria,id_categoriaProducto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE categoriaProductos SET descripcionCategoria = ?  where id_categoriaProducto = ? ';
        const param = [descripcionCategoria,id_categoriaProducto];

        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;

            }
        } catch (error) {
            throw new Error('NO se logo descripcionCategoria mediante id_categoriaProducto enbase de datos  / Problema al establecer la conexion con la base de datos desde la clase Categorias.js')

        }
    }






}