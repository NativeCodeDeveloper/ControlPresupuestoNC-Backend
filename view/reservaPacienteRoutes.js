import {Router} from 'express';
import ReservaPacienteController from "../controller/ReservaPacienteController.js";

const router = Router();

// Rutas para gestión de reservas existentes
router.get("/seleccionarReservados", ReservaPacienteController.seleccionarReservados);
router.post("/seleccionarSegunEstado", ReservaPacienteController.seleccionarSegunEstado);
router.post("/insertarReservaPacienteFicha", ReservaPacienteController.insertarReservaPacienteFicha);
router.post("/validar", ReservaPacienteController.validacionDisponibilidad);
router.post("/insertarReserva", ReservaPacienteController.insertarReservaPaciente);
router.post("/actualizarEstado", ReservaPacienteController.actualizarEstado);
router.post("/seleccionarNombre", ReservaPacienteController.buscarSimilitudNombre);
router.post("/seleccionarRut", ReservaPacienteController.buscarSimilitudRut);
router.post("/buscarEntreFechas", ReservaPacienteController.buscarEntreFechas);
router.post("/eliminarReserva", ReservaPacienteController.eliminarReserva);
router.post("/seleccionarEspecifica", ReservaPacienteController.seleccionarReservaEspecifica);
router.post("/actualizarReservacion", ReservaPacienteController.actualizarInformacionReserva);


export default router;
