import { Router } from "express";
import express from "express";
import multer from "multer";
import CloudflareController from "../controller/CloudflareController.js";

const router = Router();

// multer en memoria para obtener req.file.buffer y pasarlo al controlador
const upload = multer({ storage: multer.memoryStorage() });

// Subir imagen (multipart/form-data, campo 'image')
router.post("/subirimagenes", upload.single("image"), CloudflareController.uploadImage);

// Crear URL de subida directa (JSON body)
router.post("/api/images/direct-upload", express.json(), CloudflareController.createDirectUploadUrl);


export default router;