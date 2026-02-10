import FichaClinica from "../model/FichaClinica.js";

export default class FichaClinicaController {

    constructor() {
    }

    // 1. FUNCION CONTROLLER PARA SELECCIONAR TODAS LAS FICHAS CLINICAS
    static async seleccionarTodasFichas(req, res) {
        try {
            const fichaClinicaModel = new FichaClinica();
            const dataFichas = await fichaClinicaModel.selectFicha();
            if (dataFichas) {
                return res.status(200).json(dataFichas);
            }
        } catch (error) {
            return res.status(500).json({message: "sindato",});
        }
    }


    // 2. FUNCION CONTROLLER PARA SELECCIONAR LAS FICHAS CLINICAS ESPECIFICAS POR PACIENTE
    static async seleccionarFichasPaciente(req, res) {
        try {
            const {id_paciente} = req.body;
            console.log(req.body);


            if (!id_paciente) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaclinicamodel = new FichaClinica();
            const dataFichaClinica = await fichaclinicamodel.selectFichasPaciente(id_paciente);
            if (dataFichaClinica) {
                return res.status(200).json(dataFichaClinica);
            } else {
                return res.status(404).json({message: "sindato",});
            }
        } catch (error) {
            return res.status(500).json({message: "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",});
        }
    }

    //3. FUNCION CONTROLLER PARA EDITAR LOS DATOS DE LOS PACIENTES
    static async editarFichaPaciente(req, res) {
        try {
            const {
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado,
                id_ficha
            } = req.body;

            console.log(req.body);

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaclinicamodel = new FichaClinica();
            const resultadoQuery = await fichaclinicamodel.updateFichaEspecifica(tipoAtencion, motivoConsulta, signosVitales, observaciones, anotacionConsulta, anamnesis, diagnostico, indicaciones, archivosAdjuntos, fechaConsulta, consentimientoFirmado, id_ficha)
            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }
        } catch (error) {
            return res.status(500).json({message: "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",});
        }
    }


    //4. FUNCION PARA INSERTAR UNA NUEVA FICHA CLINICA EN UN PACIENTE ESPECIFICO (USANDO EL ID PACIENTE)
    static async insertarNuevaFichaPaciente(req, res) {
        try {

            const {
                id_paciente,
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado
            } = req.body;
            console.log(req.body);


            if (!id_paciente) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaclinicamodel = new FichaClinica();
            const resultadoQuery = await fichaclinicamodel.insertarFichaNueva(
                id_paciente,
                tipoAtencion,
                motivoConsulta,
                signosVitales,
                observaciones,
                anotacionConsulta,
                anamnesis,
                diagnostico,
                indicaciones,
                archivosAdjuntos,
                fechaConsulta,
                consentimientoFirmado
            );

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }

        } catch (error) {
            return res.status(500).json({
                message:
                    "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",
            });
        }
    }

    //5. FUNCION CONTROLLER PARA ELIMINAR FICHA CLINICA DE MANERA LOGICA DEJANDOLA EN ESTADO CERO USANDO ID DE PACIENTE E ID DE LA FICHA
    static async eliminarFicha(req, res) {
        try {
            console.log(req.body);
            const {id_ficha} = req.body;

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaClinicaModel = new FichaClinica();
            const resultadoQuery = await fichaClinicaModel.deleteFichaEspecifica(id_ficha);

            if (resultadoQuery.affectedRows > 0) {
                return res.status(200).json({message: true});
            } else {
                return res.status(404).json({message: false});
            }
        } catch (error) {
            return res.status(500).json({
                message:
                    "No se ha podido realizar la consulta desde FichaClinicaController / Contacte al equipo de soporte",
            });
        }
    }

    //6. SELECCIONAR LAS FICHAS CLINICAS POR ID DE LA FICHA Y POR EL ID DEL PACIENTE
    static async seleccionarFichaPacientePorIDdeFicha(req, res) {
        try {
            const {id_paciente, id_ficha} = req.body;
            if (!id_paciente || !id_ficha) {
                return res.status(400).json({message: "sindato"});
            }
            const fichaClinicaModel = new FichaClinica();
            const dataFichaClinca = await fichaClinicaModel.selectFichasPacientePorId(id_paciente, id_ficha);
            if (dataFichaClinca) {
                return res.status(200).json(dataFichaClinca);
            } else {
                return res.status(404).json({message: "sindato"});
            }
        } catch (error) {
            return res.status(500).json({
                message: "no ha sido posible realizar la query desde FichaClinicaController"
            })
        }
    }

    //7. SELECCIONAR LAS FICHAS CLINICAS POR ID DE LA FICHA
    static async seleccionarFichaID(req, res) {
        try {

            const {id_ficha} = req.body;

            if (!id_ficha) {
                return res.status(400).json({message: "sindato"});
            }

            const fichaClinicaModel = new FichaClinica();
            const dataFichaClinca = await fichaClinicaModel.seleccionarPorIdFicha(id_ficha);
            if (dataFichaClinca) {
                return res.status(200).json(dataFichaClinca);
            } else {
                return res.status(404).json({message: "sindato"});
            }
        } catch (error) {
            return res.status(500).json({
                message: "no ha sido posible realizar la query desde FichaClinicaController"
            })
        }
    }


}
