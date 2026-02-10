import DataBase from "../config/Database.js";


export default class SubSubCategoriaProductos {

    constructor(id_subsubcategoria,id_subcategoria,descripcionSubSubCategoria,imagenReferencial,estado_SubSubcategoria) {
        this.id_subsubcategoria = id_subsubcategoria;
        this.id_subcategoria = id_subcategoria;
        this.descripcionSubSubCategoria = descripcionSubSubCategoria;
        this.imagenReferencial = imagenReferencial;
        this.estado_SubSubcategoria = estado_SubSubcategoria;
    }


    //FUNCION PARA SELECCIONAR SUBCATEGORIA ESPECIFICA POR SU ID
    async seleccionarSubSubCategoriaPorCategoria(id_subsubcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM SubSubCategoriaProductos WHERE id_subsubcategoria = ? AND estado_SubSubcategoria <> 0'
            const params = [id_subsubcategoria];


            const resultadoConsulta = await conexion.ejecutarQuery(query, params);
            if (resultadoConsulta){
                return resultadoConsulta;
            }

        }catch (error) {
            throw Error(error);
        }




    }

    //FUNCION PARA SELECCIONAR TODAS LAS SUBCATEGORIAS
    async seleccionarSubSubCategoriasTodas() {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM SubSubCategoriaProductos WHERE estado_SubSubcategoria <> 0';
            const respuestaConsulta = await conexion.ejecutarQuery(query);

            if(respuestaConsulta){
                return respuestaConsulta;
            }

        }catch(err) {
            throw Error(err);
        }
    }

    //FUNCION PARA SELECCIONAR SUBCATEGORIA ESPECIFICA POR SU ID ADE LA SUBCATEGORIA A LA CUAL A SU VEZ PERTENECEN
    async seleccionarSubSubCategoriaPorIdDeSubcategoria(id_subcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM SubSubCategoriaProductos WHERE id_subcategoria = ? AND estado_SubSubcategoria <> 0'
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
    async actualizarSubSubCategoria(descripcionSubSubCategoria, imagenReferencial, id_subsubcategoria) {

        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE SubSubCategoriaProductos SET descripcionSubSubCategoria = ?, imagenReferencial = ? WHERE id_subsubcategoria = ? AND estado_SubSubcategoria <> 0';
            const params = [descripcionSubSubCategoria, imagenReferencial, id_subsubcategoria];
            const resultadoConsulta = await conexion.ejecutarQuery(query, params);

            if (resultadoConsulta){
                return resultadoConsulta;
            }

        }catch(err) {
            throw Error(err);
        }
    }

    // FUNCION PARA INSERTAR UNA NUEVA SUBCATEGORIA
    async insertarSubSubCategoria(descripcionSubSubCategoria, imagenReferencial, id_subcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO SubSubCategoriaProductos (descripcionSubSubCategoria, imagenReferencial, id_subcategoria) VALUES (?,?,?)';
            const params = [descripcionSubSubCategoria, imagenReferencial, id_subcategoria];


            const resultadoConsulta = await conexion.ejecutarQuery(query, params);

            if (resultadoConsulta){
                return resultadoConsulta;
            }

        }catch (error) {
            throw Error(error);
        }

    }

    //FUNCION PARA ELIMINAR SUBCATEGORIA (ELIMINADO LOGICO)
    async eliminarSubSubCategoria(id_subsubcategoria) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE SubSubCategoriaProductos SET estado_SubSubcategoria = 0 WHERE id_subsubcategoria = ?';
            const params = [id_subsubcategoria];

            const resultadoConsulta = await conexion.ejecutarQuery(query, params);
            if (resultadoConsulta){
                return resultadoConsulta;
            }
        }catch(err) {
            throw Error(err);
        }
    }

}