import DataBase from "../config/Database.js";

export default class Cupones {

    constructor(id_cupon, nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento, estadoCupon) {
        this.id_cupon = id_cupon;
        this.nombreCupon = nombreCupon;
        this.codigoVerificadorCupon = codigoVerificadorCupon;
        this.objetivoCupon = objetivoCupon;
        this.porcentajeDescuento = porcentajeDescuento;
        this.estadoCupon = estadoCupon;
    }


    async seleccionarTablaCupones() {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM cuponesDescuento WHERE estadoCupon <> 0';
            const resultadoQuery = await conexion.ejecutarQuery(query);
            if (resultadoQuery) {
                return resultadoQuery;
            } else {
                return [];
            }
        } catch (err) {
            throw new Error(err);

        }
    }


    async seleccionarCuponCodigo(codigoVerificadorCupon) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM cuponesDescuento WHERE estadoCupon <> 0 AND codigoVerificadorCupon = ?';
            const params = [codigoVerificadorCupon];

            const resultadoQuery = await conexion.ejecutarQuery(query, params);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (err) {
            throw new Error(err);
        }

    }






    async seleccionarCuponEspecificoPorID(id_cupon) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM cuponesDescuento WHERE estadoCupon <> 0 AND id_cupon = ?';
            const params = [id_cupon];

            const resultadoQuery = await conexion.ejecutarQuery(query, params);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (err) {
            throw new Error(err);
        }

    }


    async insertarCupon(nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO cuponesDescuento (nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento) VALUES (?,?,?,?)';
            const params = [nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento];
            const resultadoQuery = await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (err) {
            throw new Error(err);
        }
    }




    async atualizarCupon(nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento, id_cupon) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE cuponesDescuento SET nombreCupon = ?, codigoVerificadorCupon = ?, objetivoCupon = ?, porcentajeDescuento = ? WHERE id_cupon = ?';
            const params = [nombreCupon, codigoVerificadorCupon, objetivoCupon, porcentajeDescuento, id_cupon];

            const resultadoQuery = await conexion.ejecutarQuery(query, params);

            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (err) {
            throw new Error(err);
        }
    }





    async eliminarCupon(id_cupon) {
    try{
    const conexion = DataBase.getInstance();
    const query = 'UPDATE cuponesDescuento SET estadoCupon = 0 WHERE id_cupon = ?';
    const params = [id_cupon];

    const resultadoQuery = await conexion.ejecutarQuery(query, params);

    if (resultadoQuery) {
        return resultadoQuery;
    }

    }catch(err){
        throw new Error(err);
    }

    }




}








