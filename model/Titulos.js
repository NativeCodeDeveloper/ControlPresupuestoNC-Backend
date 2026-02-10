import DataBase from "../config/Database.js";

export default class Titulos {
    constructor(id_titulo, titulo) {
        this.id_titulo = id_titulo;
        this.titulo = titulo;
    }
    get idtitulo() {
        return this._idtitulo;
    }
    set idtitulo(in_idtitulo) {
        this._idtitulo = in_idtitulo;
    }

    get titulo() {
        return this._titulo;
    }
    set titulo(in_titulo) {
        this._titulo = in_titulo;
    }






    async selectTitulos() {
        const conexion = DataBase.getInstance();
        const query = "SELECT * FROM TitulosSecciones";

        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            console.log(error);
        }
    }






    async updateTituloPrincipal(nuevoTitulo) {
        const conexion = DataBase.getInstance();
        const query = "UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 1 ";
        const param = [nuevoTitulo];

        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (
                resultado.affectedRows !== undefined &&
                resultado.affectedRows !== null
            ) {
                return resultado.affectedRows;
            } else {
                return resultado;
            }
        } catch (error) {
            console.log(error);
        }
    }



    async updateSubTitulo(nuevoSubTitulo) {
        const conexion = DataBase.getInstance();
        const query = "UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 2 ";
        const param = [nuevoSubTitulo];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (
                resultado.affectedRows !== undefined &&
                resultado.affectedRows !== null
            ) {
                return resultado.affectedRows;
            } else {
                return resultado;
            }
        } catch (error) {
            console.log(error);
        }
    }



    async updateSobreNosotros(nuevoSobreNosotros){
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 3 '
            const param = [nuevoSobreNosotros];

            const resultado = await conexion.ejecutarQuery(query,param)

            if (resultado.affectedRows !==undefined && resultado.affectedRows !== null ) {
                return resultado.affectedRows;
            } else{
                return resultado;
            }



        } catch (error) {
            throw new Error('No fue posible ejecutar la consulta desde la clase Titulo.js especificamente el titulo sobre nosotros');
        }
    }




    async updateTituloProyectos(nuevoTituloProyecto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 4 ';
        const param = [nuevoTituloProyecto];

        try {
            const resultado = await conexion.ejecutarQuery(query, param);

            if (resultado.affectedRows !== undefined && resultado.affectedRows !== null) {
                return resultado.affectedRows;
            }else{
                return resultado;
            }

        } catch (error) {
            throw new Error('Error al ejecutar consuta desde la clase Titulos.js ')

        }

    }



    async updateContactoTitulo(contactoTitulo){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 5 ';
        const param = [contactoTitulo]

        try {

            const resultado = await conexion.ejecutarQuery(query,param )
            const columnaAfectada = resultado.affectedRows;

            if (columnaAfectada !== undefined && columnaAfectada !== null) {
                return columnaAfectada;
            }else{
                return resultado;
            }
                    } catch (error) {
            throw new Error('Error al ejecutar consuta desde la clase Titulos.js ')

        }
    }



    async updatePoliticaPrivacidadTitulo(politicaPrivacidad){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE TitulosSecciones SET titulo = ? WHERE id_titulo = 6 ';
        const param = [politicaPrivacidad]

        try {

            const resultado = await conexion.ejecutarQuery(query,param )
            if (resultado){
                return resultado;
            }
        } catch (error) {
            throw new Error('Error al ejecutar consuta desde la clase Titulos.js para el titulo de politicas de privacidad ')

        }
    }


}
