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
    if (!fchResol) {
        // Obligatorio por schema (cvc-complex-type.2.4.a), incluso con NroResol=0 (autorización
        // por folios, sin número de resolución) — confirmado contra el validador real del SII
        // al recibir "Invalid content was found starting with element 'NroResol'. One of
        // '{FchResol}' is expected" en la primera prueba real (2026-07-19).
        throw new Error('buildCaratula requiere fchResol (fecha de autorización SII), incluso con nroResol=0');
    }
    const timestamp = new Date().toISOString().slice(0, 19);
    // OJO: dentro de <SubTotDTE> el tag correcto es <TpoDTE>, no <TipoDTE> (ese nombre solo es
    // correcto dentro de <IdDoc> del propio DTE) — confirmado contra el validador real del SII
    // ("Invalid content... One of '{TpoDTE}' is expected", 2026-07-19).
    const subtotalesXml = subtotales
        .map((s) => `<SubTotDTE>\n${tag('TpoDTE', s.tipoDte)}${tag('NroDTE', s.cantidad)}</SubTotDTE>\n`)
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
    // Cada documento (buildYFirmarDte().dteXmlFirmado) trae su propio prólogo <?xml ...?> porque
    // también puede usarse standalone — pero un <?xml?> (processing instruction) solo es válido al
    // inicio absoluto de un documento XML, nunca anidado dentro de otro. Hay que quitarlo antes de
    // insertarlo en el sobre. Confirmado contra el validador real del SII ("The processing
    // instruction target matching '[xX][mM][lL]' is not allowed", 2026-07-19).
    const documentosSinProlog = documentosFirmadosXml.map((xml) => xml.replace(/^\s*<\?xml[^>]*\?>\s*/, ''));
    const setDte = `<SetDTE ID="${envioId}">\n${caratulaXml}\n${documentosSinProlog.join('\n')}\n</SetDTE>`;

    const envioXml =
        `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
        `<EnvioDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
        `xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" version="1.0">\n` +
        setDte +
        `\n</EnvioDTE>`;

    return signDocumento(envioXml, pemData, envioId);
}
