import DataBase from "../config/Database.js";


export default class SubCategoriaProductos {

    constructor(id_subcategoria,id_categoriaProducto,estado_subcategoria,descripcionCategoria,imagenSubCategoria) {
        this.id_subcategoria = id_subcategoria;
        this.id_categoriaProducto = id_categoriaProducto;
        this.estado_subcategoria = estado_subcategoria;
        this.descripcionCategoria = descripcionCategoria;
        this.imagenSubCategoria = imagenSubCategoria;
    }


    //FUNCION PARA SELECCIONAR SUBCATEGORIA ESPECIFICA POR SU ID
    async seleccionarSubCategoriaPorCategoria(id_categoriaProducto) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM subcategoriaProductos WHERE id_categoriaProducto = ? AND estado_subcategoria <> 0'
            const params = [id_categoriaProducto];


            const resultadoConsulta = await conexion.ejecutarQuery(query, params);
            if (resultadoConsulta){
                return resultadoConsulta;
            }

        }catch (error) {
            throw Error(error);
        }




    }

    //FUNCION PARA SELECCIONAR TODAS LAS SUBCATEGORIAS
    async seleccionarSubCategoriasTodas() {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM subcategoriaProductos WHERE estado_subcategoria <> 0';
            const respuestaConsulta = await conexion.ejecutarQuery(query);

            if(respuestaConsulta){
                return respuestaConsulta;
            }

        }catch(err) {
            throw Error(err);
        }
    }




    //FUNCION PARA SELECCIONAR SUBCATEGORIA ESPECIFICA POR SU ID
    async seleccionarSubCategoriaPorId(id_subcategoria) {
     try {
         const conexion = DataBase.getInstance();
         const query = 'SELECT * FROM subcategoriaProductos WHERE id_subcategoria = ? AND estado_subcategoria <> 0'
         const params = [id_subcategoria];

         const resultadoConsulta = await conexion.ejecutarQuery(query, params);
         if (resultadoConsulta){
             return resultadoConsulta;
         }

     }catch (error) {
         throw Error(error);
     }




    }





    // FUNCION PARA ACTUALIZAR LOS DATOS DE LA SUBCATEGORIA SEGUN SU ID
    async actualizarSubCategoria(descripcionCategoria, imagenSubCategoria, id_categoriaProducto, id_subcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE subcategoriaProductos SET descripcionCategoria = ?, imagenSubCategoria = ?, id_categoriaProducto = ? WHERE id_subcategoria = ? AND estado_subcategoria <> 0 ';
            const params = [descripcionCategoria, imagenSubCategoria, id_categoriaProducto, id_subcategoria];

            const resultadoConsulta = await conexion.ejecutarQuery(query, params);

            if (resultadoConsulta){
                return resultadoConsulta;
            }
        } catch (err) {
            throw Error(err);
        }
    }


    // FUNCION PARA INSERTAR UNA NUEVA SUBCATEGORIA
    async insertarSubCategoria(descripcionCategoria, imagenSubCategoria, id_categoriaProducto) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO subcategoriaProductos (descripcionCategoria, imagenSubCategoria, id_categoriaProducto) VALUES (?,?,?)';
            const params = [descripcionCategoria, imagenSubCategoria, id_categoriaProducto];

            const resultadoConsulta = await conexion.ejecutarQuery(query, params);

            if (resultadoConsulta){
                return resultadoConsulta;
            }
        } catch (error) {
            throw Error(error);
        }
    }




    //FUNCION PARA ELIMINAR SUBCATEGORIA (ELIMINADO LOGICO)
    async eliminarSubCategoria(id_subcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE subcategoriaProductos SET estado_subcategoria = 0 WHERE id_subcategoria = ?';
            const params = [id_subcategoria];

            const resultadoConsulta = await conexion.ejecutarQuery(query, params);
            if (resultadoConsulta){
                return resultadoConsulta;
            }
        }catch(err) {
            throw Error(err);
        }
    }



}