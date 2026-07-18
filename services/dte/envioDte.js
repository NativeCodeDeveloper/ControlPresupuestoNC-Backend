import { signDocumento } from './signXml.js';

// Sobre de envío (EnvioDTE): agrupa uno o más DTE ya firmados para enviarlos al SII en un solo
// archivo. Referencia: Instructivo Técnico Factura Electrónica, Anexo 3.2/3.3.
// Máximo 2.000 documentos por envío (Factura, Anexo 3.3.4) / 500 boletas por envío (Formato
// Boletas Electrónicas v4.00, sección 2).

const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `<${name}>${value}</${name}>\n`);

/**
 * Arma la <Caratula> del envío: identifica emisor, quién envía, y totales por tipo de documento.
 * @param {Object} params
 * @param {string} params.rutEmisor
 * @param {string} params.rutEnvia - RUT de la persona/firmante que envía (puede ser el mismo emisor)
 * @param {string} [params.rutReceptor='60803000-K'] - RUT del SII como receptor del envío
 * @param {string} params.fchResol - fecha de la resolución SII que autoriza al emisor (AAAA-MM-DD)
 * @param {number} params.nroResol - número de la resolución SII (0 si es autorización por folios)
 * @param {Array<{ tipoDte: number, cantidad: number }>} params.subtotales
 */
export function buildCaratula({ rutEmisor, rutEnvia, rutReceptor = '60803000-K', fchResol, nroResol = 0, subtotales }) {
    const timestamp = new Date().toISOString().slice(0, 19);
    const subtotalesXml = subtotales
        .map((s) => `<SubTotDTE>\n${tag('TipoDTE', s.tipoDte)}${tag('NroDTE', s.cantidad)}</SubTotDTE>\n`)
        .join('');

    return (
        `<Caratula version="1.0">\n` +
        tag('RutEmisor', rutEmisor) +
        tag('RutEnvia', rutEnvia) +
        tag('RutReceptor', rutReceptor) +
        tag('FchResol', fchResol) +
        tag('NroResol', nroResol) +
        tag('TmsFirmaEnv', timestamp) +
        subtotalesXml +
        `</Caratula>`
    );
}

/**
 * Arma y firma el sobre <EnvioDTE> completo: carátula + set de DTEs ya firmados individualmente.
 * @param {string} caratulaXml - resultado de buildCaratula
 * @param {string[]} documentosFirmadosXml - cada uno ya firmado (buildYFirmarDte().dteXmlFirmado),
 *   se extrae y reinserta solo el <Documento>...</Documento> de cada uno junto a su <Signature>.
 * @param {Object} pemData - certificado del emisor, ver signXml.pfxToPem
 * @param {string} envioId - id único del envío, referenciado por la firma del sobre.
 */
export function buildYFirmarEnvioDte(caratulaXml, documentosFirmadosXml, pemData, envioId = 'SetDoc') {
    const setDte = `<SetDTE ID="${envioId}">\n${caratulaXml}\n${documentosFirmadosXml.join('\n')}\n</SetDTE>`;

    const envioXml =
        `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
        `<EnvioDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
        `xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" version="1.0">\n` +
        setDte +
        `\n</EnvioDTE>`;

    return signDocumento(envioXml, pemData, envioId);
}
