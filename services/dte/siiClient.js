import { signWholeDocument } from './signXml.js';

// Cliente contra los webservices del SII para autenticación (semilla/token) y envío de DTE.
// IMPORTANTE: getSemilla/obtenerToken están basados en el WSDL público confirmado en esta sesión
// (maullin.sii.cl/DTEWS/CrSeed.jws, GetTokenFromSeed.jws). enviarSetDte está basado en el "Manual
// Desarrollador Externo — Envío Automático DTE" (OI2003_UPDTE_MDE) del propio SII. Ninguno se ha
// probado todavía contra el SII real (falta CAF) — probar con datos sintéticos antes de gastar
// folios reales del Set de Pruebas.

const SII_HOSTS = {
    certificacion: 'maullin.sii.cl',
    produccion: 'palena.sii.cl',
};

const SOAP_NS = 'http://DefaultNamespace';

function soapEnvelope(bodyXml) {
    return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
        `xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<soapenv:Body>${bodyXml}</soapenv:Body></soapenv:Envelope>`
    );
}

async function soapCall(url, bodyXml, soapAction) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            SOAPAction: soapAction,
        },
        body: soapEnvelope(bodyXml),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`SII webservice ${url} respondió ${res.status}: ${text.slice(0, 500)}`);
    }
    return text;
}

// Extrae el contenido de un tag XML por nombre, sin depender de un parser estricto — el SOAP
// response envuelve el XML de respuesta del SII como string escapado dentro de *Return.
function extractTag(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
    return match ? match[1].trim() : null;
}

function decodeXmlEntities(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Obtiene una semilla (válida ~2 minutos) del SII, primer paso de la autenticación automática.
 * @param {'certificacion'|'produccion'} ambiente
 * @returns {Promise<string>} la semilla (string numérico)
 */
export async function getSemilla(ambiente = 'certificacion') {
    const host = SII_HOSTS[ambiente];
    const url = `https://${host}/DTEWS/CrSeed.jws`;
    const soapResponse = await soapCall(url, `<getSeed xmlns="${SOAP_NS}"/>`, '');
    const returnXml = decodeXmlEntities(extractTag(soapResponse, 'getSeedReturn') || '');
    const semilla = extractTag(returnXml, 'SEMILLA');
    const estado = extractTag(returnXml, 'ESTADO');
    if (!semilla) {
        throw new Error(`No se pudo obtener semilla del SII (estado=${estado ?? 'desconocido'}): ${returnXml.slice(0, 300)}`);
    }
    return semilla;
}

/**
 * Firma la semilla con el certificado del emisor, según el formato exigido por getToken.
 * @param {string} semilla
 * @param {{ privateKeyPem, certPem, certificate }} pemData
 * @returns {string} XML firmado, listo para enviar a getToken
 */
export function firmarSemilla(semilla, pemData) {
    const xml = `<getToken><item><Semilla>${semilla}</Semilla></item></getToken>`;
    return signWholeDocument(xml, pemData);
}

/**
 * Canjea la semilla firmada por un token de sesión.
 * @param {string} semillaFirmadaXml
 * @param {'certificacion'|'produccion'} ambiente
 * @returns {Promise<string>} el token
 */
export async function getToken(semillaFirmadaXml, ambiente = 'certificacion') {
    const host = SII_HOSTS[ambiente];
    const url = `https://${host}/DTEWS/GetTokenFromSeed.jws`;
    const escaped = semillaFirmadaXml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const soapResponse = await soapCall(url, `<getToken xmlns="${SOAP_NS}"><pszXml>${escaped}</pszXml></getToken>`, '');
    const returnXml = decodeXmlEntities(extractTag(soapResponse, 'getTokenReturn') || '');
    const token = extractTag(returnXml, 'TOKEN');
    const estado = extractTag(returnXml, 'ESTADO');
    if (!token) {
        throw new Error(`No se pudo obtener token del SII (estado=${estado ?? 'desconocido'}): ${returnXml.slice(0, 300)}`);
    }
    return token;
}

/**
 * Flujo completo de autenticación: semilla -> firma -> token.
 * @param {{ privateKeyPem, certPem, certificate }} pemData
 * @param {'certificacion'|'produccion'} ambiente
 * @returns {Promise<string>} token
 */
export async function obtenerToken(pemData, ambiente = 'certificacion') {
    const semilla = await getSemilla(ambiente);
    const semillaFirmada = firmarSemilla(semilla, pemData);
    return getToken(semillaFirmada, ambiente);
}

/**
 * Envía un sobre EnvioDTE ya firmado al SII vía upload (multipart/form-data).
 * Referencia: Manual Desarrollador Externo — Envío Automático DTE (OI2003_UPDTE_MDE), Cap. 2.
 * @param {Object} params
 * @param {string} params.envioXmlFirmado - el <EnvioDTE> firmado completo
 * @param {string} params.rutEnvia - RUT (sin DV) de quien envía
 * @param {string} params.dvEnvia - dígito verificador de quien envía
 * @param {string} params.rutCompania - RUT (sin DV) de la empresa emisora
 * @param {string} params.dvCompania - dígito verificador de la empresa
 * @param {string} params.token
 * @param {'certificacion'|'produccion'} [params.ambiente]
 * @returns {Promise<{ status: number, trackId: string|null, raw: string }>}
 */
export async function enviarSetDte({ envioXmlFirmado, rutEnvia, dvEnvia, rutCompania, dvCompania, token, ambiente = 'certificacion' }) {
    const host = SII_HOSTS[ambiente];
    const url = `https://${host}/cgi_dte/UPL/DTEUpload`;

    const form = new FormData();
    form.append('rutSender', rutEnvia);
    form.append('dvSender', dvEnvia);
    form.append('rutCompany', rutCompania);
    form.append('dvCompany', dvCompania);
    form.append('archivo', new Blob([envioXmlFirmado], { type: 'text/xml' }), 'EnvioDTE.xml');

    const res = await fetch(url, {
        method: 'POST',
        headers: { Cookie: `TOKEN=${token}` },
        body: form,
    });
    const text = await res.text();
    const status = Number(extractTag(text, 'STATUS'));
    const trackId = extractTag(text, 'TRACKID');
    return { status, trackId, raw: text };
}

/**
 * Consulta el estado de un envío por su Track ID.
 * NOTA: endpoint/operación (QueryEstUp.jws) documentado extensamente en guías públicas de
 * integración DTE, pero no confirmado contra un WSDL propio en esta sesión — verificar formato
 * exacto de respuesta en la primera prueba real.
 * @param {Object} params
 * @param {string} params.trackId
 * @param {string} params.rutCompania
 * @param {string} params.dvCompania
 * @param {string} params.token
 * @param {'certificacion'|'produccion'} [params.ambiente]
 */
export async function consultarEstadoEnvio({ trackId, rutCompania, dvCompania, token, ambiente = 'certificacion' }) {
    const host = SII_HOSTS[ambiente];
    const url = `https://${host}/DTEWS/QueryEstUp.jws`;
    const body =
        `<getEstUp xmlns="${SOAP_NS}">` +
        `<RutEmpresa>${rutCompania}</RutEmpresa><DvEmpresa>${dvCompania}</DvEmpresa>` +
        `<Token>${token}</Token><TrackId>${trackId}</TrackId>` +
        `</getEstUp>`;
    const soapResponse = await soapCall(url, body, '');
    const returnXml = decodeXmlEntities(extractTag(soapResponse, 'getEstUpReturn') || '');
    return {
        estado: extractTag(returnXml, 'ESTADO'),
        glosa: extractTag(returnXml, 'GLOSA') || extractTag(returnXml, 'ESTADO_MSG'),
        raw: returnXml,
    };
}
