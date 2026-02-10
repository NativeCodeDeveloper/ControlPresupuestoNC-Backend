import { Router } from "express";
import correosAutomaticosController from "../controller/CorreosAutomaticosController.js";
import {enviarCorreoComprobante} from "../services/emailService.js";

const router = Router();

// POST /api/contacto
//router.post("/contacto", (req, res) => enviarCorreoComprobante(req, res));
router.post("/contacto", (req, res) => correosAutomaticosController.enviarFormularioContacto(req, res));
router.post("/comprobante", (req, res) => correosAutomaticosController.enviarComprobanteCompra(req, res));
router.post("/seguimiento", (req, res) => correosAutomaticosController.enviarSeguimiento(req, res));

export default router;