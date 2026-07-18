import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';

// Timbre Electrónico del DTE (TED). Referencia: SII "Instructivo Técnico Factura Electrónica"
// (28/10/2021), ANEXO 2. Firma distinta a la del documento completo: se usa la llave privada
// del CAF (no el certificado .pfx), algoritmo SHA1withRSA, y una canonicalización propia del
// SII (no XMLDSig/C14N estándar) — ver Anexo 2.4.

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// Trunca al largo máximo del campo y luego escapa las 5 entidades XML predefinidas (Anexo 2.4).
// El orden importa: truncar después de escapar podría cortar una entidad a la mitad (ej.
// "Empresa&amp;B" cortado en el carácter 9 quedaría "Empresa&a", XML inválido).
export function escapeTedText(value, maxLength) {
    const str = String(value ?? '');
    const truncated = maxLength ? str.slice(0, maxLength) : str;
    return truncated.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
}

// Parsea el XML del CAF (tal como lo entrega el SII) y devuelve sus campos relevantes.
// Estructura: <AUTORIZACION><CAF><DA>...</DA><FRMA>...</FRMA></CAF><RSASK>...</RSASK><RSAPUBK>...</RSAPUBK></AUTORIZACION>
export function parseCaf(cafXml) {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false });
    const parsed = parser.parse(cafXml);
    const autorizacion = parsed.AUTORIZACION;
    if (!autorizacion?.CAF) throw new Error('XML de CAF inválido: falta sección CAF');

    const da = autorizacion.CAF.DA;
    return {
        rutEmisor: String(da.RE),
        razonSocial: String(da.RS),
        tipoDte: Number(da.TD),
        folioDesde: Number(da.RNG.D),
        folioHasta: Number(da.RNG.H),
        fechaAutorizacion: String(da.FA),
        rsaPrivateKeyPem: String(autorizacion.RSASK).trim(),
        rsaPublicKeyPem: String(autorizacion.RSAPUBK).trim(),
        // XML original del bloque <CAF>...</CAF>, tal cual, sin modificar — se debe incluir
        // dentro del TED sin ningún cambio respecto al recibido del SII (Anexo 1.3).
        cafXmlOriginal: extractCafBlock(cafXml),
    };
}

// Extrae el bloque <CAF ...>...</CAF> textual original (para incrustarlo sin modificar en el TED).
function extractCafBlock(cafXml) {
    const match = cafXml.match(/<CAF[\s\S]*?<\/CAF>/);
    if (!match) throw new Error('No se pudo extraer el bloque <CAF> del XML de autorización');
    return match[0];
}

// Confirma que un folio está dentro del rango autorizado por el CAF.
export function folioEnRango(caf, folio) {
    return Number(folio) >= caf.folioDesde && Number(folio) <= caf.folioHasta;
}

/**
 * Arma la sección <DD> del Timbre Electrónico (Anexo 2.3), en el orden exacto que exige el SII:
 * RE, TD, F, FE, RR, RSR, MNT, IT1, CAF, TSTED.
 */
export function buildTedDatos({ caf, folio, fechaEmision, rutReceptor, razonSocialReceptor, montoTotal, primerItem, timestamp }) {
    if (!folioEnRango(caf, folio)) {
        throw new Error(`Folio ${folio} fuera del rango autorizado por el CAF (${caf.folioDesde}-${caf.folioHasta})`);
    }
    const rsr = escapeTedText(razonSocialReceptor, 40);
    const it1 = escapeTedText(primerItem, 40);

    return (
        `<DD>` +
        `<RE>${caf.rutEmisor}</RE>` +
        `<TD>${caf.tipoDte}</TD>` +
        `<F>${folio}</F>` +
        `<FE>${fechaEmision}</FE>` +
        `<RR>${rutReceptor}</RR>` +
        `<RSR>${rsr}</RSR>` +
        `<MNT>${Math.round(Number(montoTotal))}</MNT>` +
        `<IT1>${it1}</IT1>` +
        `${caf.cafXmlOriginal}` +
        `<TSTED>${timestamp}</TSTED>` +
        `</DD>`
    );
}

/**
 * Elimina los caracteres (saltos de línea, tabs, espacios de indentación) que quedan entre el
 * tag de cierre de un elemento y el de apertura del siguiente, sin tocar el contenido de texto
 * de los elementos terminales (Anexo 2.4). Como el contenido de texto nunca queda adyacente a
 * un '>' o '<' propio, un reemplazo de espacios entre '>' y '<' es equivalente a la regla del SII.
 */
export function canonicalizeSiiTed(xmlString) {
    return xmlString.replace(/>\s+</g, '><');
}

// Firma la sección Datos (ya canonicalizada) con la llave privada del CAF. SHA1withRSA,
// codificación DER PKCS#1, base64 (Anexo 2, Sección Firma).
export function signTed(datosCanonico, rsaPrivateKeyPem) {
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(datosCanonico, 'latin1');
    signer.end();
    return signer.sign(rsaPrivateKeyPem).toString('base64');
}

// Verifica una firma de TED contra la llave pública del CAF (útil para tests / auto-chequeo).
export function verifyTed(datosCanonico, firmaBase64, rsaPublicKeyPem) {
    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(datosCanonico, 'latin1');
    verifier.end();
    return verifier.verify(rsaPublicKeyPem, Buffer.from(firmaBase64, 'base64'));
}

// Ensambla el <TED> completo: datos (sin canonicalizar, para incrustar en el DTE con formato
// legible) + firma sobre la versión canonicalizada.
export function buildTed({ caf, folio, fechaEmision, rutReceptor, razonSocialReceptor, montoTotal, primerItem, timestamp }) {
    const datos = buildTedDatos({ caf, folio, fechaEmision, rutReceptor, razonSocialReceptor, montoTotal, primerItem, timestamp });
    const firma = signTed(canonicalizeSiiTed(datos), caf.rsaPrivateKeyPem);
    return `<TED version="1.0">${datos}<FRMT algoritmo="SHA1withRSA">${firma}</FRMT></TED>`;
}
