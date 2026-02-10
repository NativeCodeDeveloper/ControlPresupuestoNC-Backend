import DataBase from "../config/Database.js";


export default class FichaClinica {
    constructor(id_ficha, id_paciente, tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, estadoFicha, consentimientoFirmado) {

        this.id_ficha = id_ficha;
        this.id_paciente = id_paciente;
        this.tipoAtencion = tipoAtencion;
        this.motivoConsulta = motivoConsulta;
        this.signosVitales = signosVitales;
        this.observaciones = observaciones;
        this.anotacionConsulta = anotacionConsulta;
        this.anamnesis = anamnesis;
        this.diagnostico = diagnostico;
        this.indicaciones = indicaciones;
        this.archivosAdjuntos = archivosAdjuntos;
        this.fechaConsulta = fechaConsulta;
        this.estadoFicha = estadoFicha;
        this.consentimientoFirmado = consentimientoFirmado;
    }

    // 1. SELECCION DE TODAS LAS FICHAS CLINICAS DE LA BASE DE DATOS
    async selectFicha() {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM fichaClinica WHERE estadoFicha <> 0';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase FichaClinica.js')
        }
    }

// 2. ELECCION DE LAS FICHAS CLINICAS ESPECIFICAS POR id_paciente
    async selectFichasPaciente(id_paciente) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM fichaClinica WHERE id_paciente = ? AND estadoFicha <> 0 ORDER BY fechaConsulta DESC';        const param = [id_paciente]
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('No se puede seleccionar Informacion la ficha clinica / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }

// 3. SELECCION DE LAS FICHAS CLINICAS ESPECIFICAS POR  id_paciente e id_fichas
    async selectFichasPacientePorId(id_paciente, id_ficha) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM fichaClinica WHERE id_paciente = ? AND id_ficha = ? AND estadoFicha <> 0 ORDER BY fechaConsulta DESC';
        const param = [id_paciente, id_ficha]

        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('No se puede seleccionar Informacion la ficha clinica / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }

// 4. ACTUALIZACION DE DATOS DE LA FICHA DE PACIENTES POR POR ID
    async updateFichaEspecifica(tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, consentimientoFirmado, id_ficha) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE fichaClinica SET tipoAtencion = ? ,motivoConsulta = ? ,signosVitales = ? ,observaciones = ? ,anotacionConsulta = ? ,anamnesis = ? ,diagnostico = ? ,indicaciones = ? ,archivosAdjuntos = ? ,fechaConsulta = ? ,consentimientoFirmado = ? WHERE id_ficha = ?';
        const param = [tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, consentimientoFirmado, id_ficha];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logro actualizar FichaEspecifica  / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }

// 5. INSERCION DE NUEVA FICHA POR PACIENTE EN LA BASE DE DATOS
    async insertarFichaNueva(id_paciente, tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, consentimientoFirmado) {
        const conexion = DataBase.getInstance();
        const query = 'INSERT INTO fichaClinica (id_paciente,tipoAtencion,motivoConsulta,signosVitales,observaciones,anotacionConsulta,anamnesis,diagnostico,indicaciones,archivosAdjuntos,fechaConsulta,consentimientoFirmado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?);';
        const param = [id_paciente, tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, consentimientoFirmado];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('No se logró ingresar nueva ficha clínica / Problema al establecer la conexión con la base de datos desde la clase FichaClinica.js')
        }
    }

    // 6. ELIMINACION LOGICA DE FICHA CLINICA DE LA BASE DE DATOS
    async deleteFichaEspecifica(id_ficha) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE fichaClinica SET estadoFicha = 0 WHERE id_ficha = ?';
        const param = [id_ficha];

        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logo Eliminar Ficha Clinica especificada / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }


    // 7. SELECCION DE LAS FICHAS CLINICAS ESPECIFICAS POR id_fichas
    async seleccionarPorIdFicha(id_ficha) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM fichaClinica WHERE id_ficha = ? AND estadoFicha <> 0 ORDER BY fechaConsulta DESC';
        const param = [id_ficha]

        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if (resultado) {
                return resultado;
            }
        } catch (error) {
            throw new Error('No se puede seleccionar Informacion la ficha clinica / Problema al establecer la conexion con la base de datos desde la clase FichaClinica.js')
        }
    }


}
