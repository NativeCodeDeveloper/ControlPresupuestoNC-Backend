import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as Adjuntos from '../model/Adjuntos.js';
import { r2Client, R2_BUCKET } from '../config/r2Config.js';

const ENTIDADES_VALIDAS = new Set(['tarea', 'team', 'iniciativa']);

export default class AdjuntosController {

    static async upload(req, res) {
        try {
            const { entidad, id_entidad } = req.body;
            if (!ENTIDADES_VALIDAS.has(entidad))
                return res.status(400).json({ error: 'Entidad inválida' });
            if (!req.file)
                return res.status(400).json({ error: 'No se recibió ningún archivo' });

            const ext = path.extname(req.file.originalname).toLowerCase();
            const r2Key = `adjuntos/${uuidv4()}${ext}`;

            await r2Client.send(new PutObjectCommand({
                Bucket:             R2_BUCKET,
                Key:                r2Key,
                Body:               req.file.buffer,
                ContentType:        req.file.mimetype,
                ContentDisposition: `attachment; filename="${encodeURIComponent(req.file.originalname)}"`,
            }));

            const adj = await Adjuntos.createAdjunto({
                entidad,
                id_entidad:      parseInt(id_entidad),
                nombre_original: req.file.originalname,
                nombre_archivo:  r2Key,
                mimetype:        req.file.mimetype,
                tamanio:         req.file.size,
            });

            res.status(201).json(adj);
        } catch (e) {
            console.error('[ADJUNTOS] upload:', e.message);
            res.status(500).json({ error: 'Error al subir archivo' });
        }
    }

    static async list(req, res) {
        try {
            const { entidad, id } = req.params;
            if (!ENTIDADES_VALIDAS.has(entidad))
                return res.status(400).json({ error: 'Entidad inválida' });
            res.json(await Adjuntos.getAdjuntos(entidad, id));
        } catch (e) {
            console.error('[ADJUNTOS] list:', e.message);
            res.status(500).json({ error: 'Error al listar adjuntos' });
        }
    }

    static async download(req, res) {
        try {
            const adj = await Adjuntos.getAdjunto(req.params.id);
            if (!adj) return res.status(404).json({ error: 'Archivo no encontrado' });

            const { Body } = await r2Client.send(new GetObjectCommand({
                Bucket: R2_BUCKET,
                Key:    adj.nombre_archivo,
            }));

            res.setHeader('Content-Type', adj.mimetype);
            res.setHeader('Content-Disposition',
                `attachment; filename="${encodeURIComponent(adj.nombre_original)}"`);

            Body.pipe(res);
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
