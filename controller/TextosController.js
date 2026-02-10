
import Textos from "../model/Textos.js";

export default class TextosController {
    constructor() {}



    static async getTextos(req, res) {
        try {
            const Textos = new Textos();
            const textosRes = await Textos.cargarTextos();
            if (textosRes){
                res.status(200).json(textosRes);
                return textosRes;
            }

        } catch (error) {
            return res.status(500).json({error : 'error al cargar datos desde controller'})

        }

    }




    static async cargarTextos(req, res) {
        try {
            const textosRes = await Textos.cargarTextos();
            return res.json(textosRes);
        } catch (error) {}
        res.status(500).json({error : 'error al cargar datos desde controller'})
    }
    static async cambiarTexto1(req, res){
        console.log(req.body);
        const {texto1} = req.body;
        if (!texto1) {
            return res.status(400).json({message : 'Error al consultar base de datos desde la clase controller'})
        }
        try {
            const textos = new Textos();
            const resultado = await textos.updateTexto1(texto1);
            res.json({message : "Titulo de sobre Nosotros actualizado correctamente",  resultado})

        } catch (error) {
            res.status(500).json({message : 'Error al realizar la consulta a la base de datos desde controller'})
        }

    }



    static async cambiarTexto2(req, res){
        console.log(req.body);
        const {texto2} = req.body;

        if (!texto2) {
            return res.status(400).json({message : 'Error al consultar base de datos desde la clase controller'})
        }

        try {

            const textos = new Textos();
            const resultado = await textos.updateTexto2(texto2);
            res.json({message : "Titulo de sobre Nosotros actualizado correctamente",  resultado})


        } catch (error) {
            res.status(500).json({message : 'Error al realizar la consulta a la base de datos desde controller'})

        }

    }
}
