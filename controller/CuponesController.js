import Cupones from "../model/Cupones.js";
import DataBase from "../config/Database.js";


export default class CuponesController {



constructor() {
}



    static async seleccionarCuponCodigo(req, res) {
        try {
            const {codigoVerificadorCupon} = req.body;

            if (!codigoVerificadorCupon) {
                return res.status(500).json({message: "sindato"})
            }else {

                const cuponesInstance = new Cupones();
                const resultadoQuery = await cuponesInstance.seleccionarCuponCodigo(codigoVerificadorCupon);

                if (Array.isArray(resultadoQuery) && resultadoQuery.length > 0) {
                    return res.status(200).json(resultadoQuery);
                }else {
                    return res.status(404).json({message: false})
                }
            }
        }catch(error) {
            return res.status(500).json({message: "serverProblem"})

        }
    }





static async seleccionarCupones(req, res) {
    try {
        const cuponesInstance = new Cupones();
        const resultadoQuery = await cuponesInstance.seleccionarTablaCupones()

        if (Array.isArray(resultadoQuery) && resultadoQuery.length > 0) {
            return res.status(200).json(resultadoQuery);
        }else {
            return res.status(404).json({message: false})
        }
    }catch(error) {
        return res.status(500).json({message: "serverProblem"})
    }
}






   static async seleccionarCuponEspecificoPorID(req, res) {
   try {
    const {id_cupon} = req.body;

    if (!id_cupon) {
        return res.status(500).json({message: "sindato"})
    }else {

        const cuponesInstance = new Cupones();
        const resultadoQuery = await cuponesInstance.seleccionarCuponEspecificoPorID(id_cupon);

        if (Array.isArray(resultadoQuery) && resultadoQuery.length > 0) {
            return res.status(200).json(resultadoQuery);
        }else {
            return res.status(404).json({message: false})
        }
    }
    }catch(error) {
    return res.status(500).json({message: "serverProblem"})

}
   }






   static async insertarCupon(req, res) {
        try {
            const {nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento} = req.body;
            console.log(nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento);

            if (!nombreCupon || !codigoVerificadorCupon || !objetivoCupon || !porcentajeDescuento) {
                res.status(400).json({message: "sindato"})
            }

            const cuponesInstance = new Cupones();
            const resultadoQuery = await cuponesInstance.insertarCupon(nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento)

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            }else {
                return res.status(404).json({message: false})
            }

        } catch (err) {
            throw new Error(err);
        }
   }







 static  async atualizarCupon(req, res) {
        try {
            const {nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento, id_cupon} = req.body;
            if (!id_cupon) {
                return res.status(400).json({message: "sindato"})
            }

            const cuponesInstance = new Cupones();
            const resultadoQuery = await cuponesInstance.atualizarCupon(nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento, id_cupon);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            }else {
                return res.status(404).json({message: false})
            }
        } catch (err) {
            throw new Error(err);
        }
    }





    static  async elimnarCupon(req, res) {
        try {
            const {id_cupon} = req.body;

            if (!id_cupon) {
             return res.status(400).json({message: "sindato"})
            }

            const cuponesInstance = new Cupones();
            const resultadoQuery = await cuponesInstance.eliminarCupon(id_cupon);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            }else {
                return res.status(404).json({message: false})
            }
        } catch (err) {
            throw new Error(err);
        }
    }
}