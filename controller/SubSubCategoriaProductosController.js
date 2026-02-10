import SubSubCategoriaProductos from "../model/SubSubCategoriaProductos.js";

export default class SubSubCategoriaProductosController {

    constructor() {
    }

    //FUNCION  PARA SELECCIONAR CATEGORIA POR ID ESPECIFICO
    static async seleccionarSubSubCategoriaPorCategoria(req, res) {
        try {
            const {id_subsubcategoria} = req.body;
            console.log(id_subsubcategoria);

            if(!id_subsubcategoria){
                return res.status(400).send({message: 'sindata'})
            }

            const SubSubCategoriasClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await SubSubCategoriasClass.seleccionarSubSubCategoriaPorCategoria(id_subsubcategoria);

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
    static async seleccionarSubSubCategoriasTodas(req, res) {

        try {
            const subSubCategoriaClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await subSubCategoriaClass.seleccionarSubSubCategoriasTodas();

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
    static async seleccionarSubSubCategoriaPorIdDeSubcategoria(req, res) {
        try {
            const { id_subcategoria } = req.body;
            console.log(id_subcategoria);

            const SubSubCategoriaClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await SubSubCategoriaClass.seleccionarSubSubCategoriaPorIdDeSubcategoria(id_subcategoria);

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
    static async actualizarSubSubCategoria(req, res) {
        try {
            const {descripcionSubSubCategoria, imagenReferencial, id_subsubcategoria} = req.body;
            console.log(descripcionSubSubCategoria, imagenReferencial, id_subsubcategoria);

            const SubSubCategoriaClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await SubSubCategoriaClass.actualizarSubSubCategoria(descripcionSubSubCategoria, imagenReferencial, id_subsubcategoria);

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
    static async insertarSubSubCategoria(req, res) {
        try {
            const {descripcionSubSubCategoria, imagenReferencial, id_subcategoria} = req.body;
            console.log(descripcionSubSubCategoria, imagenReferencial, id_subcategoria);

            if (!descripcionSubSubCategoria || !id_subcategoria || !imagenReferencial) {
                return res.status(200).send({message: "sindata"});
            }

            const SubSubCategoriaClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await SubSubCategoriaClass.insertarSubSubCategoria(descripcionSubSubCategoria, imagenReferencial, id_subcategoria);

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
    static async eliminarSubSubCategoria(req, res) {
        try {
            const {id_subsubcategoria} = req.body;
            console.log(id_subsubcategoria);

            const SubSubCategoriaClass = new SubSubCategoriaProductos();
            const resultadoConsulta = await SubSubCategoriaClass.eliminarSubSubCategoria(id_subsubcategoria);

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