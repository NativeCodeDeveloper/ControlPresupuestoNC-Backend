import Titulos from "../model/Titulos.js";

export default class TituloController {
    constructor() {}




    static async actualizarTituloPoliticas(req, res) {}



    static async mostrarTitulo(req, res) {
        try {
            const titulo = new Titulos();
            const dataTitulos = await titulo.selectTitulos();
            res.json(dataTitulos);
        } catch (error) {
            res
                .status(500)
                .json({
                    error:
                        "Error al consultar la base de datos desde la clase controller",
                });
        }
    }


    static async editarTituloPrincipal(req, res) {
        try {
            console.log("Body recibido:", req.body); // 👀 para revisar qué llega
            const { nuevoTitulo } = req.body;

            if (!nuevoTitulo) {
                return res.status(400).json({ error: "Falta el nuevoTitulo en el body" });
            }

            const titulo = new Titulos();
            const resultado = await titulo.updateTituloPrincipal(nuevoTitulo);
            res.json({ message: "Título actualizado correctamente", resultado });

        } catch (error) {
            console.error("Error en controller:", error);
            res.status(500).json({ error: "Error al actualizar el título" });
        }
    }



    static async editarSubtitulo(req, res){
        try {
            console.log("Body recibido:", req.body); // 👀 para revisar qué llega
            const {nuevoSubtitulo} = req.body;


            if (!nuevoSubtitulo) {
                return res.status(400).json({error : 'falta el nuevo subtitulo en el body'})

            }


            const titulo = new Titulos();
            const resultado = await titulo.updateSubTitulo(nuevoSubtitulo)
            res.json({ message: "Subtítulo actualizado correctamente", resultado });

        } catch (error) {
            res.status(500).json({error: 'error al actualziar subtitulo desde controller'})

        }
    }



    static async cambiarSobreNosotros(req, res){
        try {
            console.log(req.body)
            const {nuevoSobreNosotros} = req.body;

            if(!nuevoSobreNosotros){
                return res.status(400).json({error: 'Falta Contenido en el req Body o es invalido'})
            }

            const  titulo = new Titulos();
            const resultado = await titulo.updateSobreNosotros(nuevoSobreNosotros);
            res.json({message : "Titulo de sobre Nosotros actualizado correctamente",  resultado})

        } catch (error) {
            res.status(500).json({error: 'error al actualziar titulo desde controller'})
        }
    }



    static async cambiarTituloProyectos(req, res){
        try {
            console.log(req.body)
            const {nuevoTituloProyecto} = req.body;

            if (!nuevoTituloProyecto) {
                return res.status(400).json({message :'Error en el envio de req.body'})
            }

            const titulo = new Titulos();
            const resultado = await titulo.updateTituloProyectos(nuevoTituloProyecto);
            res.json({message :"Titulo proyecto actualizado", resultado})



        } catch (error) {
            res.status(500).json({error: 'error al actualziar titulo proyectos desde controller'})
        }

    }



    static async cambiarTituloContacto(req, res){
        try {
            console.log(req.body)
            const {contactoTitulo} = req.body;

            if (!contactoTitulo) {
                return res.status(400).json({message : 'Problema con la consulta  SQL desde la clase controller de titulos'})
            }

            const titulo = new Titulos();
            const resultado = await titulo.updateContactoTitulo(contactoTitulo);
            return res.json({message : 'Se ha modificdo el titulo', resultado});


        } catch (error) {
            return res.status(500).json({message : 'Problema en la consulta desde la clase controller'})

        }
    }

}
