import DataBase from "../config/Database.js";

export default class CarruselPortada {
    constructor(id_publicacionesPortada,tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,estadoPublicacionPortada) {
        this.id_publicacionesPortada = id_publicacionesPortada;
        this.tituloPortadaCarrusel = tituloPortadaCarrusel;
        this.descripcionPublicacionesPortada = descripcionPublicacionesPortada;
        this.imagenPortada = imagenPortada;
        this.estadoPublicacionPortada = estadoPublicacionPortada;
    }



    //FUNCION PARA INSERTAR NUEVA PORTADA
    async insertarPortada(tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO carruselPortada (tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada) VALUES (?,?,?)';
            const params = [tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada]

            const resultadoQuery = await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        }catch (error) {
            throw error;
        }
    }



    //FUNCION PARA EDITAR NUEVA PORTADA
    async editarPortada(tituloPortadaCarrusel,descripcionPublicacionesPortada,imagenPortada,id_publicacionesPortada) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE carruselPortada SET tituloPortadaCarrusel = ?, descripcionPublicacionesPortada = ?, imagenPortada = ? WHERE  id_publicacionesPortada = ? and estadoPublicacionPortada <> 0';
            const params = [tituloPortadaCarrusel , descripcionPublicacionesPortada ,imagenPortada , id_publicacionesPortada]
            const resultadoQuery =await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        }catch (error) {
            throw error;
        }
    }



    //FUNCION PARA ELIMINADO LOGICO DE PORTADA
    async eliminarPortada(id_publicacionesPortada) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE carruselPortada SET estadoPublicacionPortada = 0 WHERE id_publicacionesPortada = ?';
            const params = [id_publicacionesPortada]
            const resultadoQuery = await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        }catch (error) {
            throw error;
        }
    }

    //FUNCION PARA SELECCIONAR TODAS LAS PORTADAS DIFERENTES DEL ESTADO CERO
    async seleccionarPortadas() {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM carruselPortada WHERE estadoPublicacionPortada <> 0';
            const resultadoQuery = await conexion.ejecutarQuery(query);

            if (resultadoQuery) {
                return resultadoQuery ;
            }

        }catch (error) {
            throw error;
        }
    }



    //FUNCION PARA SELECCIONAR LA PORTADA ESPECIFICA POR ID
    async seleccionarPortadaEspecificaId(id_publicacionesPortada) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM carruselPortada WHERE id_publicacionesPortada = ? AND estadoPublicacionPortada <> 0';
            const params = [id_publicacionesPortada]
            const resultadoQuery = await conexion.ejecutarQuery(query, params);

            if (resultadoQuery) {
                return resultadoQuery ;
            }
s
        }catch (error) {
            throw error;
        }
    }

}