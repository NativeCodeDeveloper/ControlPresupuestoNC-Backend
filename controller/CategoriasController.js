import Categorias from "../model/Categorias.js";

export default class CategoriasController{

    constructor() {
    }

//ACTUALIZAR CATEGORIAS EN LA BASE DE DATOS
    static async actualizarCategoria(req, res) {
        try {
            const {descripcionCategoria, id_categoriaProducto} = req.body;
            console.log(req.body);
            if (!descripcionCategoria || !id_categoriaProducto) {
                return res
                    .status(400)
                    .json({ message: "Faltan datos obligatorios en el body" });
            }

            const categoria = new Categorias();
            const resultado = await categoria.actualizarCategoria(descripcionCategoria, id_categoriaProducto)
            if(resultado === 1){
                return res.json({message: true})
            }else{
                return res.json({message: false})
            }


        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde CategoriaController.js",
            });
        }
    }

//INSERTAR NUEVA CATEGORIA EN LA BASE DE DATOS
    static async insertarCategoria(req, res) {
        try {
            console.log(req.body);
            const {descripcionCategoria} = req.body;

            if (
                !descripcionCategoria) {
                return res
                    .status(400)
                    .json({ message: "Faltan datos obligatorios en el body" });
            }

            const categoria = new Categorias();
            const resultado = await categoria.insertarNuevaCategoria(descripcionCategoria);
            if(resultado){
                return res.json({"resultado": true})
            }else{
                return res.json({"resultado": false})
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde CategoriaController.js",
            });
        }
    }

// SELECCION DE TODAS LAS CATEGORIAS DE LA BASE DE DATOS
    static async seleccionarTodasCategorias(req, res) {
        try {
            const categoria = new Categorias();
            const resultado = await categoria.seleccionarTodasCategorias();
            return res.json(resultado);

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde CategoriaController.js",
            });
        }
    }

// SELECCION DE CATEGORIA DE LA BASE DE DATOS ESPECIFICAS POR ID
static async seleccionCategoriasPorId(req, res) {
        try {
            const { id_categoriaProducto } = req.params;
            console.log(id_categoriaProducto);

            if (!id_categoriaProducto) {
                return  res.status(400).json({message: 'sindato'});

            } else {

                const categoria = new Categorias();
                const resultado = await categoria.seleccionarCategoriaEspecifica(id_categoriaProducto)

                if(!resultado) {
                    return res.status(404).json({
                        message: 'sindato'
                    })
                }else{
                    return res.json(resultado)
                }

            }
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde CategoriaController.js",
            });
        }
    }

// ELIMINACION LOGICA DE CAREGORIA
static async eliminarCategoria(req, res) {
        try {
            console.log(req.body);
            const {id_categoriaProducto} = req.body;

            if (!id_categoriaProducto) {
                return res.status(400).json({ message: "sindato" });
            }

            const categoria = new Categorias();
            const resultado = await categoria.eliminarCategoria(id_categoriaProducto);

            if(resultado === 1){
                return res.status(200).json({message: true})
            }else {
                return res.status(404).json({message: false})
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }

}