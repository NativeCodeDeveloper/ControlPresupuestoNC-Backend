import DataBase from "../config/Database.js";


export default class ReservaPacientes {
    constructor(
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        rut,
        telefono,
        email,
        fechaInicio,
        horaInicio,
        fechaFinalizacion,
        horaFinalizacion,
        estadoReserva,
        estadoPeticion,
        preference_id) {

        this.id_reserva = id_reserva;
        this.nombrePaciente = nombrePaciente;
        this.apellidoPaciente = apellidoPaciente;
        this.rut = rut;
        this.telefono = telefono;
        this.email = email;
        this.fechaInicio = fechaInicio;
        this.horaInicio = horaInicio;
        this.fechaFinalizacion = fechaFinalizacion;
        this.horaFinalizacion = horaFinalizacion;
        this.estadoReserva = estadoReserva;
        this.estadoPeticion = estadoPeticion;
        this.preference_id = preference_id;

    }


    async cambiarReservaPagada(preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE reservaPacientes SET estadoReserva = 'reservada'  WHERE preference_id = ?";
            const params = [preference_id];
            const resultado = await conexion.ejecutarQuery(query, params);
            if (resultado) {
                return resultado;
            } else {
                return console.error('Ha habido un problema al ejecutar la consulta desde model en ReservaPacientes.js , NO se ha podido cambiar el estado correctamente a pagado ')
            }
        } catch (e) {
            console.log('Problema encontrado a nivel del model en ReservaPacientes.js :  ' + e);
            throw new Error('No se ha podido actualizar el pago desde la clase del modelo ReservaPacientes.js :  ' + e);
        }
    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS SEGUN ESTADO DE RESERVA INGRESADO
    async seleccionarReservaEstado(estadoReserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE estadoReserva = ? AND estadoPeticion <> 0"
            const param = [estadoReserva]
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }


    //METODO PARA ACTUALZIAR NUEVAS CITAS MEDICAS
    async actualizarReserva(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva, id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'UPDATE reservaPacientes SET nombrePaciente = ? , apellidoPaciente = ?, rut = ? , telefono = ? , email = ? , fechaInicio = ?  , horaInicio = ? , fechaFinalizacion = ? , horaFinalizacion = ? , estadoReserva = ? WHERE id_reserva = ?';
            const param = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva, id_reserva]
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (e) {
            throw new Error(e)
        }
    }


    //METODO PARA ELIMINAR LOGICAMENTE EL AGENDAMIENTO
    async eliminarReservaPaciente(id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "DELETE FROM reservaPacientes WHERE id_reserva = ?";
            const param = [id_reserva];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);
            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            throw new Error(error);
        }
    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS
    async seleccionarFichasReservadasEspecifica(id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE id_reserva = ? AND estadoPeticion <> 0"
            const param = [id_reserva];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }

    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS
    async seleccionarFichasReservadas() {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE estadoPeticion <> 0"
            const resultadoQuery = await conexion.ejecutarQuery(query);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }


    //METODO PARA INSERTAR NUEVAS CITAS MEDICAS
    async insertarReservaPaciente(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO reservaPacientes(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio,fechaFinalizacion, horaFinalizacion, estadoReserva) VALUES (?,?,?,?,?,?,?,?,?,?)';
            const param = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (e) {
            throw new Error(e)
        }
    }

//DEVUELVE UN VALOR booleano PARA EVALUAR SI LAS HORAS MEDICAS SE SUPERPONEN
    async validarDisponibilidadBoolean(fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion) {
        const conexion = DataBase.getInstance();

        const query = `
         SELECT COUNT(*) AS cnt
        FROM reservaPacientes
        WHERE NOT (
          TIMESTAMP(fechaFinalizacion, horaFinalizacion) <= TIMESTAMP(?, ?)
          OR TIMESTAMP(fechaInicio, horaInicio) >= TIMESTAMP(?, ?)
        )
    `;

        const params = [fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion];
        const filas = await conexion.ejecutarQuery(query, params);

        const cnt = Array.isArray(filas) ? filas[0].cnt : filas.cnt;
        return cnt === 0; // true = disponible
    }


    async seleccionarSimilitudNombre(nombrePaciente) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM reservaPacientes WHERE nombrePaciente LIKE ? AND estadoPeticion <> 0 ';
            const param = ['%' + nombrePaciente + '%'];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async seleccionarSimilitudRut(rut) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM reservaPacientes WHERE rut LIKE ? AND estadoPeticion <> 0 ';
            const param = ['%' + rut + '%'];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async seleccionarEntreFechas(fechaInicio, fechaFinalizacion) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'SELECT * FROM reservaPacientes WHERE fechaInicio BETWEEN  ? AND ? AND estadoPeticion <> 0 ';
            const param = [fechaInicio, fechaFinalizacion];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);

        }
    }


    async actualizarEstado(estadoReserva, id_reserva) {
        try {
            const conexion = DataBase.getInstance();
            const query = "UPDATE reservaPacientes SET estadoReserva = ? WHERE id_reserva = ?"
            const params = [estadoReserva, id_reserva];

            const resultadoQuery = await conexion.ejecutarQuery(query, params);
            if (resultadoQuery) {

                return resultadoQuery;
            }
            return null;
        } catch (error) {
            throw error;
        }
    }


    //METODO PARA INSERTAR NUEVAS CITAS MEDICAS DESDE METODOS INTERNOS DEL BACKEND COMO MERCADO PAGO
    async insertarReservaPacienteBackend(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva, preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = 'INSERT INTO reservaPacientes(nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio,fechaFinalizacion, horaFinalizacion, estadoReserva, preference_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
            const param = [nombrePaciente, apellidoPaciente, rut, telefono, email, fechaInicio, horaInicio, fechaFinalizacion, horaFinalizacion, estadoReserva, preference_id];

            const resultadoQuery = await conexion.ejecutarQuery(query, param);
            if (resultadoQuery) {
                return resultadoQuery;
            }
        } catch (e) {
            throw new Error(e)
        }
    }


    //METODO PARA SELECCIONAR TODAS LAS CITAS MEDICAS por preference_id
    async seleccionarFichasReservadasPreference(preference_id) {
        try {
            const conexion = DataBase.getInstance();
            const query = "SELECT * FROM reservaPacientes WHERE preference_id = ? AND estadoPeticion <> 0"
            const param = [preference_id];
            const resultadoQuery = await conexion.ejecutarQuery(query, param);

            if (resultadoQuery) {
                return resultadoQuery;
            }

        } catch (error) {
            console.log(error);
            throw new Error(error);
        }

    }
}