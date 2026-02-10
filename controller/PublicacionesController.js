import Publicaciones from "../model/Publicaciones.js";
import Producto from "../model/Producto.js";

export default class PublicacionesController {
    constructor() {
    }


    //ACTUALIZAR PUBLICACIONES EN LA BASE DE DATOS
    static async actualziarPublicaciones(req, res) {
        try {
            const {
                descripcionPublicaciones,
                imagenPublicaciones_primera,
                imagenPublicaciones_segunda,
                imagenPublicaciones_tercera,
                id_publicaciones
            } = req.body;

            console.log(req.body);
            if (!descripcionPublicaciones || !id_publicaciones) {
                return res.status(400).json({ message: "sindato" });
            }

            const publicaciones = new Publicaciones();
            const resultado = await publicaciones.actualizarPublicacion(
                descripcionPublicaciones,
                imagenPublicaciones_primera,
                imagenPublicaciones_segunda,
                imagenPublicaciones_tercera,
                id_publicaciones)

   if (resultado.affectedRows > 0 ) {
       return res.status(200).json({message: "true"});
   }else{
       return res.status(200).json({message: "false"});
   }
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde PublicacionesConreoller.js",
            });
        }
    }


    //INSERTAR NUEVA PUBLICACION EN LA BASE DE DATOS
    static async insertarPublicacion(req, res) {
        try {
            console.log(req.body);
            const {
                descripcionPublicaciones,
                imagenPublicaciones_primera,
                imagenPublicaciones_segunda,
                imagenPublicaciones_tercera
            } = req.body;

            if (!descripcionPublicaciones || !imagenPublicaciones_primera) {
                return res.status(400).json({ message: "sindato" });
            }

           const publicaciones = new Publicaciones();

            const resultado = await publicaciones.insertarPublicacion(
                descripcionPublicaciones,
                imagenPublicaciones_primera,
                imagenPublicaciones_segunda,
                imagenPublicaciones_tercera
            )
            if(resultado.affectedRows > 0 ) {
                return res.json({message: true})
            }else{
                return res.json({message: false})
            }

        } catch (error) {
            res.status(500).json({error: "No se ha podido realizar la consulta desde PublicacionesController.js",});
        }
    }


    // SELECCION DE TODAS LAS PUBLICACIONES DE LA BASE DE DATOS
    static async seleccionarTodasPublicaciones(req, res) {
        try {
      const publicaciones = new Publicaciones();
      const dataPublicaciones = await publicaciones.seleccionarPublicaciones();
      return res.json(dataPublicaciones);
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde PublicacionesController.js",
            });
        }
    }


    // SELECCION DE PUBLICACIO DE LA BASE DE DATOS ESPECIFICAS POR ID
    // SE USA req.params y NO req.body porque es una peticion get en body solo se usa en PUT Y POST
    static async seleccionarPublicacionEspecifica(req, res) {
        try {

            const {id_publicaciones} = req.params;
            console.log(id_publicaciones);

            if (!id_publicaciones) {
                res.status(404).json({message: "sindato",});

            } else {
                const publicaciones = new Publicaciones();
                const dataProducto = await publicaciones.seleccionarPublicacionEspecifica(id_publicaciones);

                if (!dataProducto) {
                    return res.status(404).json({
                        message: 'sindato'
                    })
                } else {
                    return res.json(dataProducto)
                }
            }
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde PublicacionController.js",
            });
        }

    }


    //METODO PARA ELIMINAR PPUBLICACION EN LA BASE DE DATOS
    static async eliminarPublicacion(req, res) {
        try {
            console.log(req.body);
            const {id_publicaciones} = req.body;

            if (!id_publicaciones) {
                return res.status(400).json({ message: "sindato" });
            }

const publicaciones = new Publicaciones();
            const resultado = await publicaciones.eliminarPublicacion(id_publicaciones);

            if(resultado === 1){
                return res.json({message: true});
            }else{
                return res.json({message: "sindato"});
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde PublicacionesController.js",
            });
        }
    }

}