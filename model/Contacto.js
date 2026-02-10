import DataBase from "../config/Database.js";

export default class Contacto {
    constructor(
        id_DatosContacto,
        telefono,
        correo,
        red_social_1,
        red_social_2,
        red_social_3,
        red_social_4
    ) {
        this.id_DatosContacto = id_DatosContacto;
        this.telefono = telefono;
        this.correo = correo;
        this.red_social_1 = red_social_1;
        this.red_social_2 = red_social_2;
        this.red_social_3 = red_social_3;
        this.red_social_4 = red_social_4;
    }
    get idDatosContacto() {
        return this._idDatosContacto;
    }
    set idDatosContacto(in_idDatosContacto) {
        this._idDatosContacto = in_idDatosContacto;
    }

    get telefono() {
        return this._telefono;
    }
    set telefono(in_telefono) {
        this._telefono = in_telefono;
    }

    get correo() {
        return this._correo;
    }
    set correo(in_correo) {
        this._correo = in_correo;
    }

    get redsocial1() {
        return this._redsocial1;
    }
    set redsocial1(in_redsocial1) {
        this._redsocial1 = in_redsocial1;
    }

    get redsocial2() {
        return this._redsocial2;
    }
    set redsocial2(in_redsocial2) {
        this._redsocial2 = in_redsocial2;
    }

    get redsocial3() {
        return this._redsocial3;
    }
    set redsocial3(in_redsocial3) {
        this._redsocial3 = in_redsocial3;
    }

    get redsocial4() {
        return this._redsocial4;
    }
    set redsocial4(in_redsocial4) {
        this._redsocial4 = in_redsocial4;
    }

    static async selectContacto() {
        const conexion = DataBase.getInstance();
        const query = "SELECT * FROM DatosContacto";

        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error(
                "Error al ejecutar consulta SQL desde la clase Contacto.js"
            );
        }
    }
}
