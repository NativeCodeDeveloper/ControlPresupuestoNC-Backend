import DataBase from "../config/Database.js";


export default class Publicaciones {
    constructor(
        id_publicaciones,
        descripcionPublicaciones,
        imagenPublicaciones_primera,
        imagenPublicaciones_segunda,
        imagenPublicaciones_tercera,
        estadoPublicacion) {

        this._id_publicaciones = id_publicaciones;
        this._descripcionPublicaciones = descripcionPublicaciones;
        this._imagenPublicaciones_primera = imagenPublicaciones_primera;
        this._imagenPublicaciones_segunda = imagenPublicaciones_segunda;
        this._imagenPublicaciones_tercera = imagenPublicaciones_tercera;
        this._estadoPublicacion = estadoPublicacion;
    }

    get id_publicaciones() {
        return this._id_publicaciones;
    }
    set id_publicaciones(value) {
        this._id_publicaciones = value;
    }
    get descripcionPublicaciones() {
        return this._descripcionPublicaciones;
    }
    set descripcionPublicaciones(value) {
        this._descripcionPublicaciones = value;
    }
    get imagenPublicaciones_primera() {
        return this._imagenPublicaciones_primera;
    }
    set imagenPublicaciones_primera(value) {
        this._imagenPublicaciones_primera = value;
    }
    get imagenPublicaciones_segunda() {
        return this._imagenPublicaciones_segunda;
    }
    set imagenPublicaciones_segunda(value) {
        this._imagenPublicaciones_segunda = value;
    }
    get imagenPublicaciones_tercera() {
        return this._imagenPublicaciones_tercera;
    }
    set imagenPublicaciones_tercera(value) {
        this._imagenPublicaciones_tercera = value;
    }
    get estadoPublicacion() {
        return this._estadoPublicacion;
    }
    set estadoPublicacion(value) {
        this._estadoPublicacion = value;
    }



    //SELECCIONAR TODAS LAS PUBLICACIONES
    async seleccionarPublicaciones() {
        const conexion = DataBase.getInstance();
        const query = "SELECT * FROM publicaciones WHERE estadoPublicacion <> 0";
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            console.log(error);
        }
    }


    //METODO PARA INSERTAR NUEVA PUBLICACION
    async insertarPublicacion(
        descripcionPublicaciones,
        imagenPublicaciones_primera,
        imagenPublicaciones_segunda,
        imagenPublicaciones_tercera
    ){
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO publicaciones(descripcionPublicaciones, imagenPublicaciones_primera, imagenPublicaciones_segunda, imagenPublicaciones_tercera) VALUES (?,?,?,?)';
        const param = [
            descripcionPublicaciones,
            imagenPublicaciones_primera,
            imagenPublicaciones_segunda,
            imagenPublicaciones_tercera
        ];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logo ingresar publicacion nueva / Problema al establecer la conexion con la base de datos desde la clase Publicaciones.js')

        }
    }



    //METODO PARA ACTUALIZAR LA PUBLICACION
    async actualizarPublicacion(
        descripcionPublicaciones,
        imagenPublicaciones_primera,
        imagenPublicaciones_segunda,
        imagenPublicaciones_tercera,
        id_publicaciones) {

        const conexion = DataBase.getInstance();
        const query = "UPDATE publicaciones SET descripcionPublicaciones = ?, imagenPublicaciones_primera = ?, imagenPublicaciones_segunda = ?,imagenPublicaciones_tercera = ?  WHERE id_publicaciones = ? ";
        const param = [
            descripcionPublicaciones,
            imagenPublicaciones_primera,
            imagenPublicaciones_segunda,
            imagenPublicaciones_tercera,
            id_publicaciones];

        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }

        } catch (error) {
            console.log(error);
        }
    }





    //METODO PARA ELIMINAR LA PUBLICACION
    async eliminarPublicacion(id_publicaciones){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE publicaciones SET estadoPublicacion = 0 where id_publicaciones = ?';
        const param = [id_publicaciones];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logo eliminar publicacion  / Problema al establecer la conexion con la base de datos desde la clase Publicaciones.js')
        }
    }





    async seleccionarPublicacionEspecifica(id_publicaciones){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM publicaciones where id_publicaciones = ? and estadoPublicacion <> 0';
        const param = [id_publicaciones];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(resultado){
                return resultado[0];
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Publicaciones.js')

        }
    }

}