import SubCategoriaProductos from "../model/SubCategoriaProductos.js";

export default class SubCategoriaController {
    constructor() {
    }

    //FUNCION  PARA SELECCIONAR CATEGORIA POR ID ESPECIFICO
    static async seleccionarSubCategoriaPorCategoria(req, res) {
        try {
            const { id_categoriaProducto } = req.body;
            console.log(id_categoriaProducto);

            if(!id_categoriaProducto){
                return res.status(400).send({message: 'sindata'})
            }

            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.seleccionarSubCategoriaPorCategoria(id_categoriaProducto)

            if (resultadoConsulta.length > 0) {
                return res.status(200).send(resultadoConsulta);
            }else{
                return res.status(200).send({message: "sindata"});
            }
        }catch (error) {
            throw Error(error);
        }
    }







    //FUNCION CONTROLLER PARA : SELECCIONAR TODAS LAS SUBCATEGORIAS
    static async seleccionarSubCategoriasTodas(req, res) {

        try {
            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.seleccionarSubCategoriasTodas();

            if (resultadoConsulta && resultadoConsulta.length > 0) {
                return res.status(200).send(resultadoConsulta);
            }else{
               return res.status(200).send({message: "sindata"});
            }
        }catch (error) {
            console.log(error);
        }
    }


    //FUNCION  PARA SELECCIONAR CATEGORIA POR ID ESPECIFICO
    static async seleccionarSubCategoriaPorId(req, res) {
        try {
            const { id_subcategoria } = req.body;
            console.log(id_subcategoria);

            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.seleccionarSubCategoriaPorId(id_subcategoria);

            if (resultadoConsulta && resultadoConsulta.length > 0) {
                return res.status(200).send(resultadoConsulta);
            }else{
                return res.status(200).send({message: "sindata"});
            }
        }catch (error) {
            console.log(error);
        }
    }


    // FUNCION PARA ACTUALIZAR LOS DATOS DE LA SUBCATEGORIA SEGUN SU ID
    static async actualizarSubcategoria(req, res) {
        try {
            const {descripcionCategoria, imagenSubCategoria, id_categoriaProducto, id_subcategoria} = req.body;
            console.log(descripcionCategoria, imagenSubCategoria, id_categoriaProducto, id_subcategoria);

            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.actualizarSubCategoria(descripcionCategoria, imagenSubCategoria, id_categoriaProducto, id_subcategoria)

            if (resultadoConsulta.affectedRows > 0) {
                return res.status(200).send({message: "true"});
            }else{
                return res.status(200).send({message: "false"});
            }
        }catch (error) {
            console.log(error);
        }
    }


    // FUNCION PARA INSERTAR UNA NUEVA SUBCATEGORIA
    static async insertarSubCategoria(req, res) {
        try {
            const {descripcionCategoria, imagenSubCategoria, id_categoriaProducto} = req.body;
            console.log(descripcionCategoria, imagenSubCategoria, id_categoriaProducto);

            if (!descripcionCategoria || !id_categoriaProducto || !imagenSubCategoria) {
                return res.status(200).send({message: "sindata"});
            }

            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.insertarSubCategoria(descripcionCategoria, imagenSubCategoria, id_categoriaProducto);

            if (resultadoConsulta.affectedRows > 0) {
                return res.status(200).send({message: "true"});
            }else{
                return res.status(200).send({message: "false"});
            }
        }catch (error) {
            console.log(error);
        }
    }


    //FUNCION PARA ELIMINAR SUBCATEGORIA (ELIMINADO LOGICO)
    static async eliminarSubCategoria(req, res) {
        try {
            const {id_subcategoria} = req.body;
            console.log(id_subcategoria);

            const SubCategoriasClass = new SubCategoriaProductos();
            const resultadoConsulta = await SubCategoriasClass.eliminarSubCategoria(id_subcategoria);

            if (resultadoConsulta.affectedRows > 0) {
                return res.status(200).send({message: "true"});
            }else{
                return res.status(200).send({message: "false"});
            }
        }catch (error) {
            console.log(error);
        }
    }
}