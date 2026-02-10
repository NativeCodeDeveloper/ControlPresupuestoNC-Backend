import CarruselPortada from '../model/CarruselPortada.js';

export default class CarruselPortadaController {
    constructor() {
    }

    //FUNCION PARA INSERTAR NUEVA PORTADA
    static async insertarPortadaController(req, res) {
        try {
            const {tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada} = req.body;

            if(!tituloPortadaCarrusel || !descripcionPublicacionesPortada || !imagenPortada){
                return res.status(400).json({message: 'sindata'})
            }


            const CarruselPortadaClass = new CarruselPortada();
            const respuestaQuery = await CarruselPortadaClass.insertarPortada(tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada);

            if(respuestaQuery.affectedRows > 0){
                return res.status(200).json({message: true})
            }else{
                return res.status(200).json({message: false})
            }

        }catch (error) {
            return res.status(500).json({message: 'servererror'})
        }
    }



    //FUNCION PARA EDITAR NUEVA PORTADA
    static async editarPortadaController(req, res) {
        try {
            const {tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,id_publicacionesPortada} = req.body;
            console.log(tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,id_publicacionesPortada);

            if(!tituloPortadaCarrusel || !descripcionPublicacionesPortada  || !id_publicacionesPortada){
                return res.status(400).json({message: 'sindata'})
            }


            const CarruselPortadaClass = new CarruselPortada();
            const respuestaQuery = await CarruselPortadaClass.editarPortada(tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,id_publicacionesPortada);

            if(respuestaQuery.affectedRows > 0){

                return res.status(200).json({message: true})
            }else{
                return res.status(200).json({message: false})
            }

        }catch (error) {
            return res.status(500).json({message: 'servererror'})
        }
    }



    //FUNCION PARA ELIMINADO LOGICO DE PORTADA
    static async eliminarPortadaController(req, res) {
        try {
            const {id_publicacionesPortada} = req.body;

            if(!id_publicacionesPortada){
                return res.status(400).json({message: 'sindata'})
            }

            const CarruselPortadaClass = new CarruselPortada();
            const respuestaQuery = await CarruselPortadaClass.eliminarPortada(id_publicacionesPortada);

            if(respuestaQuery.affectedRows > 0){

                return res.status(200).json({message: true})
            }else{
                return res.status(200).json({message: false})
            }

        }catch (error) {
            return res.status(500).json({message: 'servererror'})
        }
    }



    //FUNCION PARA SELECCIONAR TODAS LAS PORTADAS DIFERENTES DEL ESTADO CERO
    static async seleccionarPortadasController(req, res) {
        try {
            const CarruselPortadaClass = new CarruselPortada();
            const dataPortada = await CarruselPortadaClass.seleccionarPortadas();

            if(dataPortada){
                return res.status(200).json(dataPortada);
            }else {
                return res.status(200).json([]);
            }
        }catch (error) {
            return res.status(500).json({message: 'servererror'})
        }
    }


    //FUNCION PARA SELECCIONAR LA PORTADA ESPECIFICA POR ID
    static async seleccionarPortadaEspecificaIdController(req, res) {

        try {

            const {id_publicacionesPortada} = req.body;

            if(!id_publicacionesPortada){
                return res.status(400).json({message: 'sindata'})
            }

            const CarruselPortadaClass = new CarruselPortada();
            const respuestaData = await CarruselPortadaClass.seleccionarPortadaEspecificaId(id_publicacionesPortada);

            if(respuestaData){
                return res.status(200).json(respuestaData)

            }else{
                return res.status(200).json([])
            }

        }catch (error) {
            return res.status(500).json({message: 'servererror'})
        }
    }

}