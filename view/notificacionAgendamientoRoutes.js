import express from "express";
import NotificacionAgendamientoController from "../controller/NotificacionAgendamientoController.js";

const router = express.Router();

// Middleware para parsear formularios (necesario para POST con formularios HTML)
router.use(express.urlencoded({ extended: true }));

// Rutas GET: Solo muestran la página de confirmación (seguras contra pre-carga de correos)
router.get("/confirmar", NotificacionAgendamientoController.confirmarCita);
router.get("/cancelar", NotificacionAgendamientoController.cancelarCita);

// Rutas POST: Ejecutan la acción real (los clientes de correo NUNCA ejecutan POST)
router.post("/confirmar/ejecutar", NotificacionAgendamientoController.ejecutarConfirmacion);
router.post("/cancelar/ejecutar", NotificacionAgendamientoController.ejecutarCancelacion);

export default router;
