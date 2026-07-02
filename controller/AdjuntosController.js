import * as Adjuntos from '../model/Adjuntos.js';
import { UPLOADS_DIR } from '../config/uploadConfig.js';
import path from 'path';
import fs from 'fs';

const ENTIDADES_VALIDAS = new Set(['tarea', 'team', 'iniciativa']);

export default class AdjuntosController {

    static async upload(req, res) {
        try {
            const { entidad, id_entidad } = req.body;
            if (!ENTIDADES_VALIDAS.has(entidad)) {
                if (req.file) fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
                return res.status(400).json({ error: 'Entidad inválida' });
            }
            if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

            const adj = await Adjuntos.createAdjunto({
                entidad,
                id_entidad: parseInt(id_entidad),
                nombre_original: req.file.originalname,
                nombre_archivo:  req.file.filename,
                mimetype:        req.file.mimetype,
                tamanio:         req.file.size,
            });
            res.status(201).json(adj);
        } catch (e) {
            if (req.file) {
                const fp = path.join(UPLOADS_DIR, req.file.filename);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            }
            console.error('[ADJUNTOS] upload:', e.message);
            res.status(500).json({ error: 'Error al subir archivo' });
        }
    }

    static async list(req, res) {
        try {
            const { entidad, id } = req.params;
            if (!ENTIDADES_VALIDAS.has(entidad)) return res.status(400).json({ error: 'Entidad inválida' });
            const data = await Adjuntos.getAdjuntos(entidad, id);
            res.json(data);
        } catch (e) {
            console.error('[ADJUNTOS] list:', e.message);
            res.status(500).json({ error: 'Error al listar adjuntos' });
        }
    }

    static async download(req, res) {
        try {
            const adj = await Adjuntos.getAdjunto(req.params.id);
            if (!adj) return res.status(404).json({ error: 'Archivo no encontrado' });
            const filePath = path.join(UPLOADS_DIR, adj.nombre_archivo);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(adj.nombre_original)}"`);
            res.setHeader('Content-Type', adj.mimetype);
            res.sendFile(path.resolve(filePath));
        } catch (e) {
            console.error('[ADJUNTOS] download:', e.message);
            res.status(500).json({ error: 'Error al descargar archivo' });
        }
    }

    static async remove(req, res) {
        try {
            const ok = await Adjuntos.deleteAdjunto(req.params.id);
            if (!ok) return res.status(404).json({ error: 'Adjunto no encontrado' });
            res.json({ ok: true });
        } catch (e) {
            console.error('[ADJUNTOS] remove:', e.message);
            res.status(500).json({ error: 'Error al eliminar adjunto' });
        }
    }
}
