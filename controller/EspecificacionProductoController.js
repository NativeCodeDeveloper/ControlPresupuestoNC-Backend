import EspecificacionProducto from "../model/EspecificacionProducto.js";

export default class EspecificacionProductoController{

    constructor() {
    }

//ACTUALIZAR ESPECIFICACION EN LA BASE DE DATOS
    static async actualizarEspecificacion(req, res) {
        try {

            const {descripcionEspecificacion, id_subsubcategoria, id_EspecificacionProducto} = req.body;
            console.log(req.body);
            if (!descripcionEspecificacion || !id_EspecificacionProducto) {
                return res
                    .status(400)
                    .json({ message: "sindata" });
            }

            const especificacion = new EspecificacionProducto();
            const resultado = await especificacion.actualizarEspecificacion(descripcionEspecificacion, id_subsubcategoria, id_EspecificacionProducto)

            if(resultado === 1){
                return res.json({message: true})
            }else{
                return res.json({message: false})
            }


        } catch (error) {
            res.status(500).json({
                error:
                    "errorServer",
            });
        }
    }

//INSERTAR NUEVA ESPECIFICACION EN LA BASE DE DATOS
    static async insertarEspecificacion(req, res) {
        try {
            console.log(req.body);
            const {descripcionEspecificacion, id_subsubcategoria} = req.body;

            if (!descripcionEspecificacion) {
                return res
                    .status(400)
                    .json({ message: "sindata" });
            }

            const especificacion = new EspecificacionProducto();
            const resultado = await especificacion.insertarNuevaEspecificacion(descripcionEspecificacion, id_subsubcategoria);
            if(resultado){
                return res.json({message: true})
            }else{
                return res.json({message: false})
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "errorServer",
            });
        }
    }

// SELECCION DE TODAS LAS ESPECIFICACIONES DE LA BASE DE DATOS
    static async seleccionarTodasEspecificaciones(req, res) {
        try {
            const especificacion = new EspecificacionProducto();
            const resultado = await especificacion.seleccionarTodasEspecificaciones();
            return res.json(resultado);

        } catch (error) {
            res.status(500).json({
                error:
                    "errorServer",
            });
        }
    }

// SELECCION DE ESPECIFICACION DE LA BASE DE DATOS ESPECIFICA POR ID
    static async seleccionarEspecificacionEspecificaController(req, res) {

        try {
            const { id_EspecificacionProducto } = req.body;
            console.log(id_EspecificacionProducto);

            if (!id_EspecificacionProducto) {
                return  res.status(400).json({message: 'sindato'});

            } else {

                const especificacion = new EspecificacionProducto();
                const resultado = await especificacion.seleccionarEspecificacionEspecifica(id_EspecificacionProducto)

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
                    "errorServer",
            });
        }
    }

// ELIMINACION LOGICA DE ESPECIFICACION
    static async eliminarEspecificacion(req, res) {
        try {
            console.log(req.body);
            const {id_EspecificacionProducto} = req.body;

            if (!id_EspecificacionProducto) {
                return res.status(400).json({ message: "sindato" });
            }

            const especificacion = new EspecificacionProducto();
            const resultado = await especificacion.eliminarEspecificacion(id_EspecificacionProducto);

            if(resultado === 1){
                return res.status(200).json({message: true})
            }else {
                return res.status(404).json({message: false})
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde EspecificacionProductoController.js",
            });
        }
    }







    // SELECCION DE ESPECIFICACION DE LA BASE DE DATOS ESPECIFICA POR ID DE SUBSUBCATEGORIA
    static async seleccionarEspecificacionEspecificaPorIdSubSubCategoriaCotroller(req, res) {

        try {
            const { id_subsubcategoria } = req.body;
            console.log("id_subsubcategoria recibido:", id_subsubcategoria);

            if (!id_subsubcategoria) {
                return res.status(400).json({message: 'sindato'});
            }

            const especificacion = new EspecificacionProducto();
            const resultado = await especificacion.seleccionarEspecificacionEspecificaPorIdSubSubCategoria(id_subsubcategoria);

            // Siempre devolver un array (vacío si no hay resultados)
            return res.json(Array.isArray(resultado) ? resultado : []);

        } catch (error) {
            console.error("Error en seleccionarEspecificacionEspecificaPorIdSubSubCategoriaCotroller:", error);
            res.status(500).json({
                error: "errorServer",
            });
        }
    }
}