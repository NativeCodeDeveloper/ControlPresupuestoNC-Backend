import DataBase from "../config/Database.js";
export default class Textos {
    constructor(id_Textos, titulo_id, contenido) {
        this.id_Textos = id_Textos;
        this.titulo_id = titulo_id;
        this.contenido = contenido;
    }

    get idTextos() {
        return this._idTextos;
    }
    set idTextos(in_idTextos) {
        this._idTextos = in_idTextos;
    }

    get tituloid() {
        return this._tituloid;
    }
    set tituloid(in_tituloid) {
        this._tituloid = in_tituloid;
    }

    get contenido() {
        return this._contenido;
    }
    set contenido(in_contenido) {
        this._contenido = in_contenido;
    }



    static async cargarTextos() {
        const conexion = DataBase.getInstance();
        const query = "SELECT * FROM Textos ";

        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;

        } catch (error) {
            console.log(error);
        }
    }



    async updateTexto1(texto1){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE Textos SET contenido = ? WHERE id_Textos= 1'
        const param = [texto1];

        try {
            const resultado = await conexion.ejecutarQuery(query, param)
            const columnasAfectadas = resultado.affectedRows;

            if (columnasAfectadas !== undefined && columnasAfectadas !== null) {
                return columnasAfectadas;
            }else{
                return resultado
            }

        } catch (error) {
            throw new Error('Error al actualizar cadena de texto desde la clase Textos.js');
        }
    }




    async updateTexto2(texto2){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE Textos SET contenido = ? WHERE id_Textos= 2'
        const param = [texto2];

        try {
            const resultado = await conexion.ejecutarQuery(query, param)
            const columnasAfectadas = resultado.affectedRows;

            if (columnasAfectadas !== undefined && columnasAfectadas !== null) {
                return columnasAfectadas;
            }else{
                return resultado
            }

        } catch (error) {
            throw new Error('Error al actualizar cadena de texto desde la clase Textos.js');
        }
    }
}
