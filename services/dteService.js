import fs from 'fs';
import DataBase from '../config/Database.js';
import { parseCaf } from './dte/ted.js';
import { pfxToPem, extraerRutCertificado } from './dte/signXml.js';
import { buildDte } from './dte/dteXml.js';
import { buildEnvioDteSinFirmar, firmarEnvioDteEnSitio } from './dte/envioDte.js';
import * as siiClient from './dte/siiClient.js';

// Orquestador de emisión de DTE: reserva de folio (atómica), armado+firma (services/dte/*),
// envío al SII (siiClient) y persistencia (dte_documentos). No requiere infraestructura nueva —
// el certificado y los CAF viven como archivos en el VPS, fuera de git (ver .env DTE_*).

function splitRut(rutConGuion) {
    const [cuerpo, dv] = String(rutConGuion).split('-');
    return { rut: cuerpo, dv: (dv || '').toUpperCase() };
}

let certificadoCache = null;

/** Carga y cachea el certificado del emisor desde DTE_CERT_PATH/DTE_CERT_PASS. */
function cargarCertificado() {
    if (certificadoCache) return certificadoCache;
    const certPath = process.env.DTE_CERT_PATH;
    const certPass = process.env.DTE_CERT_PASS;
    if (!certPath || !certPass) {
        throw new Error('DTE_CERT_PATH / DTE_CERT_PASS no configurados en el .env del backend');
    }
    if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado no encontrado en ${certPath}`);
    }
    certificadoCache = pfxToPem(fs.readFileSync(certPath), certPass);
    return certificadoCache;
}

async function cargarCafPorId(idCaf) {
    const db = DataBase.getInstance();
    const rows = await db.ejecutarQuery('SELECT ruta_archivo FROM dte_caf WHERE id = ? AND activo = 1', [idCaf]);
    if (!rows.length) throw new Error(`CAF id=${idCaf} no encontrado o inactivo`);
    const rutaArchivo = rows[0].ruta_archivo;
    if (!fs.existsSync(rutaArchivo)) throw new Error(`Archivo de CAF no encontrado en ${rutaArchivo}`);
    return parseCaf(fs.readFileSync(rutaArchivo, 'utf8'));
}

/**
 * Reserva el próximo folio disponible para un tipo de documento, de forma atómica (dentro de
 * una transacción con lock de fila) para que dos emisiones concurrentes nunca usen el mismo
 * folio. Recorre los CAF activos en orden y avanza al siguiente cuando el actual se agota.
 */
async function reservarFolio(conn, tipoDte, ambiente) {
    const [cafRows] = await conn.query(
        'SELECT id, folio_desde, folio_hasta FROM dte_caf WHERE tipo_dte = ? AND ambiente = ? AND activo = 1 ORDER BY folio_desde ASC FOR UPDATE',
        [tipoDte, ambiente]
    );
    if (!cafRows.length) {
        throw new Error(`No hay CAF cargado para tipo ${tipoDte} (${ambiente}). Cargar uno en dte_caf antes de emitir.`);
    }

    const [consumidos] = await conn.query(
        'SELECT folio FROM dte_folios_consumidos WHERE tipo_dte = ? AND ambiente = ? ORDER BY folio DESC LIMIT 1',
        [tipoDte, ambiente]
    );
    const ultimoConsumido = consumidos[0]?.folio ?? null;

    for (const caf of cafRows) {
        let candidato = null;
        if (ultimoConsumido === null || ultimoConsumido < caf.folio_desde) {
            candidato = caf.folio_desde;
        } else if (ultimoConsumido < caf.folio_hasta) {
            candidato = ultimoConsumido + 1;
        } else {
            continue; // este CAF está agotado, probar el siguiente rango
        }
        await conn.query('INSERT INTO dte_folios_consumidos (tipo_dte, folio, ambiente) VALUES (?, ?, ?)', [tipoDte, candidato, ambiente]);
        return { folio: candidato, idCaf: caf.id };
    }
    throw new Error(`No quedan folios disponibles en los CAF cargados para tipo ${tipoDte} (${ambiente})`);
}

/**
 * Emite un DTE completo: reserva folio, arma el Documento y el sobre EnvioDTE sin firmar, firma
 * "en sitio" (Documento y luego SetDTE, ya ensamblados en su posición final -- ver
 * envioDte.js firmarEnvioDteEnSitio), lo envía al SII, y persiste el resultado (éxito o error) en
 * dte_documentos (`xml_firmado` guarda el sobre EnvioDTE completo, no solo el Documento).
 *
 * @param {Object} params
 * @param {number} params.idProyecto
 * @param {number} [params.idPago]
 * @param {33|39} params.tipoDte
 * @param {Object} params.emisor - { rut, razonSocial, giro, direccion, comuna, acteco }
 * @param {Object} params.receptor - { rut, nombre, giro, direccion, comuna }
 * @param {Array}  params.detalle
 * @param {string} [params.fechaVencimiento]
 * @param {'certificacion'|'produccion'} [params.ambiente]
 * @param {string} [params.emitidoPor] - id de usuario Clerk
 */
export async function emitirDte({ idProyecto, idPago = null, tipoDte, emisor, receptor, detalle, fechaVencimiento, ambiente = 'certificacion', emitidoPor = null }) {
    const db = DataBase.getInstance();
    const pemData = cargarCertificado();

    const { folio, idCaf } = await db.withTransaction((conn) => reservarFolio(conn, tipoDte, ambiente));

    try {
        const caf = await cargarCafPorId(idCaf);
        const fechaEmision = new Date().toISOString().slice(0, 10);

        const { documentoId, montos, documentoXml } = buildDte({
            tipoDte, folio, fechaEmision, fechaVencimiento, emisor, receptor, detalle, caf,
        });

        const { rut: rutEmisorSinDv, dv: dvEmisor } = splitRut(emisor.rut);
        // RutEnvia debe ser el RUT del titular del certificado (quien firma), no necesariamente
        // el de la empresa emisora — pueden ser personas distintas (representante autorizado).
        const { rut: rutEnviaSinDv, dv: dvEnvia } = splitRut(extraerRutCertificado(pemData.certificate));

        const documentos = [{ documentoId, documentoXml, tipoDte }];
        const envioId = `SetDoc${documentoId}`;
        // FchResol/NroResol son la Resolución real del SII que autoriza al contribuyente como
        // emisor DTE (visible en "Actualización de datos empresa autorizada" del portal) -- NO
        // el "0 = autorización por folios" que se asumió antes. NATIVECODE SPA tiene Resolución
        // N°99 del 21-10-2014 (confirmado 2026-07-19, ver DTE_NRO_RESOLUCION/DTE_FCH_RESOLUCION
        // en el .env) -- mandar 0 + la fecha del CAF era información incorrecta en la Carátula.
        const { envioXmlSinFirmar } = buildEnvioDteSinFirmar({
            rutEmisor: emisor.rut,
            rutEnvia: `${rutEnviaSinDv}-${dvEnvia}`,
            fchResol: process.env.DTE_FCH_RESOLUCION || caf.fechaAutorizacion,
            nroResol: process.env.DTE_NRO_RESOLUCION !== undefined ? Number(process.env.DTE_NRO_RESOLUCION) : 0,
            documentos,
            envioId,
        });
        // Firmar "en sitio" (Documento y luego SetDTE, ya insertados en su posición final dentro
        // del sobre completo) -- ver envioDte.js firmarEnvioDteEnSitio para el porqué: firmar
        // antes de ensamblar el sobre invalidaba la firma contra el SII real (2026-07-19).
        const envioFirmado = firmarEnvioDteEnSitio(envioXmlSinFirmar, documentos, envioId, pemData);

        const token = await siiClient.obtenerToken(pemData, ambiente);
        const resultadoEnvio = await siiClient.enviarSetDte({
            envioXmlFirmado: envioFirmado,
            rutEnvia: rutEnviaSinDv,
            dvEnvia,
            rutCompania: rutEmisorSinDv,
            dvCompania: dvEmisor,
            token,
            ambiente,
        });

        const estadoSii = resultadoEnvio.status === 0 ? 'enviado' : 'rechazado';
        const errorMensaje = resultadoEnvio.status !== 0 ? `SII status=${resultadoEnvio.status}: ${resultadoEnvio.raw.slice(0, 400)}` : null;

        const insertResult = await db.ejecutarQuery(
            `INSERT INTO dte_documentos
                (id_proyecto, id_pago, tipo_dte, folio, ambiente, track_id, estado_sii,
                 monto_neto, monto_iva, monto_exento, monto_total,
                 receptor_rut, receptor_nombre, detalle_json, xml_firmado, error_mensaje, emitido_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                idProyecto, idPago, tipoDte, folio, ambiente, resultadoEnvio.trackId, estadoSii,
                montos.montoNeto, montos.iva, montos.montoExento, montos.montoTotal,
                receptor.rut || null, receptor.nombre || null, JSON.stringify(detalle), envioFirmado, errorMensaje, emitidoPor,
            ]
        );
        await db.ejecutarQuery(
            'UPDATE dte_folios_consumidos SET id_dte_documento = ? WHERE tipo_dte = ? AND folio = ? AND ambiente = ?',
            [insertResult.insertId, tipoDte, folio, ambiente]
        );

        return { ok: estadoSii === 'enviado', idDte: insertResult.insertId, folio, trackId: resultadoEnvio.trackId, estadoSii, montos, errorMensaje };
    } catch (error) {
        // El folio ya quedó reservado (no se puede reutilizar aunque falle el envío) — se
        // registra el intento fallido para trazabilidad, sin perder el número de folio.
        await db.ejecutarQuery(
            `INSERT INTO dte_documentos
                (id_proyecto, id_pago, tipo_dte, folio, ambiente, estado_sii, monto_total, receptor_rut, receptor_nombre, detalle_json, error_mensaje, emitido_por)
             VALUES (?,?,?,?,?, 'rechazado', 0, ?, ?, ?, ?, ?)`,
            [idProyecto, idPago, tipoDte, folio, ambiente, receptor.rut || null, receptor.nombre || null, JSON.stringify(detalle), error.message, emitidoPor]
        );
        console.error('[dteService.emitirDte] Error:', error);
        throw error;
    }
}

/** Devuelve el último documento emitido para un proyecto (para "similar al último"). */
export async function obtenerUltimoDocumento(idProyecto) {
    const db = DataBase.getInstance();
    const rows = await db.ejecutarQuery(
        `SELECT id, tipo_dte, folio, estado_sii, monto_total, receptor_rut, receptor_nombre, detalle_json, emitido_en
         FROM dte_documentos WHERE id_proyecto = ? AND activo = 1 ORDER BY emitido_en DESC LIMIT 1`,
        [idProyecto]
    );
    if (!rows.length) return null;
    const doc = rows[0];
    return { ...doc, detalle: typeof doc.detalle_json === 'string' ? JSON.parse(doc.detalle_json) : doc.detalle_json };
}

/** Listado global de documentos emitidos (todos los proyectos) — para la vista de control "Documentos Tributarios". */
export async function obtenerDocumentosGlobal({ tipoDte, estado, ambiente, limit = 200 } = {}) {
    const db = DataBase.getInstance();
    const where = ['activo = 1'];
    const params = [];
    if (tipoDte) { where.push('tipo_dte = ?'); params.push(tipoDte); }
    if (estado) { where.push('estado_sii = ?'); params.push(estado); }
    if (ambiente) { where.push('ambiente = ?'); params.push(ambiente); }
    params.push(Math.min(Number(limit) || 200, 500));

    return db.ejecutarQuery(
        `SELECT id, id_proyecto, id_pago, tipo_dte, folio, ambiente, track_id, estado_sii,
                monto_neto, monto_iva, monto_exento, monto_total, receptor_rut, receptor_nombre,
                error_mensaje, emitido_por, emitido_en
         FROM dte_documentos WHERE ${where.join(' AND ')} ORDER BY emitido_en DESC LIMIT ?`,
        params
    );
}

/** Historial de documentos de un proyecto. */
export async function obtenerHistorialProyecto(idProyecto) {
    const db = DataBase.getInstance();
    return db.ejecutarQuery(
        `SELECT id, tipo_dte, folio, ambiente, estado_sii, track_id, monto_total, receptor_nombre, emitido_en
         FROM dte_documentos WHERE id_proyecto = ? AND activo = 1 ORDER BY emitido_en DESC`,
        [idProyecto]
    );
}

/** Indica si hay al menos un CAF activo cargado por tipo de documento (para habilitar el botón "Emitir" en el frontend). */
export async function obtenerEstadoCaf(ambiente = 'certificacion') {
    const db = DataBase.getInstance();
    const rows = await db.ejecutarQuery(
        `SELECT tipo_dte, MIN(folio_desde) AS folio_desde, MAX(folio_hasta) AS folio_hasta
         FROM dte_caf WHERE ambiente = ? AND activo = 1 GROUP BY tipo_dte`,
        [ambiente]
    );
    return {
        boleta39: rows.some((r) => r.tipo_dte === 39),
        factura33: rows.some((r) => r.tipo_dte === 33),
        detalle: rows,
    };
}

/** Actualiza el estado SII de los documentos que quedaron "enviado" (cron). */
export async function actualizarEstadosPendientes(ambiente = 'certificacion') {
    const db = DataBase.getInstance();
    const pendientes = await db.ejecutarQuery(
        `SELECT id, track_id, tipo_dte FROM dte_documentos WHERE estado_sii = 'enviado' AND track_id IS NOT NULL AND activo = 1`
    );
    if (!pendientes.length) return { revisados: 0, actualizados: 0 };

    const pemData = cargarCertificado();
    const token = await siiClient.obtenerToken(pemData, ambiente);
    const emisorRut = process.env.DTE_RUT_EMISOR;
    if (!emisorRut) throw new Error('DTE_RUT_EMISOR no configurado en el .env del backend');
    const { rut, dv } = splitRut(emisorRut);

    let actualizados = 0;
    for (const doc of pendientes) {
        try {
            const { estado } = await siiClient.consultarEstadoEnvio({ trackId: doc.track_id, rutCompania: rut, dvCompania: dv, token, ambiente });
            if (!estado) continue;
            const nuevoEstado = estado === '0' || estado === 'OK' ? 'aceptado' : estado.toLowerCase().includes('rech') ? 'rechazado' : 'observado';
            await db.ejecutarQuery('UPDATE dte_documentos SET estado_sii = ? WHERE id = ?', [nuevoEstado, doc.id]);
            actualizados++;
        } catch (error) {
            console.error(`[dteService.actualizarEstadosPendientes] Error consultando track ${doc.track_id}:`, error.message);
        }
    }
    return { revisados: pendientes.length, actualizados };
}
