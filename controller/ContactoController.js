import Contacto from "../model/Contacto.js";

export default class ContactoController {
    constructor(){

    }

    static async cargarDatosContacto(req, res){
        try {
            const dataContacto = await Contacto.selectContacto();
            return res.json(dataContacto);
        } catch (error) {
            throw new Error('Problema al ejecutar consulta desde la clase ContactoController.js');

        }
    }
}