import { signDocumento } from './signXml.js';

// Sobre de envío (EnvioDTE): agrupa uno o más DTE (armados por dteXml.buildDte, sin firmar) para
// enviarlos al SII en un solo archivo. Referencia: Instructivo Técnico Factura Electrónica, Anexo
// 3.2/3.3. Máximo 2.000 documentos por envío (Factura, Anexo 3.3.4).
//
// IMPORTANTE (confirmado contra el validador de schema real del SII, 2026-07-19): este sobre
// <EnvioDTE> es válido para TipoDTE ∈ {33,34,43,46,52,56,61,110,111,112} — NO para Boleta (39).
// El schema del SII rechaza explícitamente TipoDTE=39 aquí ("cvc-enumeration-valid"). Boleta
// Electrónica usa un sobre y trámite de envío separados (<EnvioBOLETA>, Formato Boletas
// Electrónicas v4.00) — todavía no implementado en este archivo. No usar estas funciones para
// Boleta hasta construir ese sobre específico.

const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `<${name}>${value}</${name}>\n`);

/**
 * Arma la <Caratula> del envío: identifica emisor, quién envía, y totales por tipo de documento.
 * @param {Object} params
 * @param {string} params.rutEmisor
 * @param {string} params.rutEnvia - RUT de la persona/firmante que envía (puede ser el mismo emisor)
 * @param {string} [params.rutReceptor='60803000-K'] - RUT del SII como receptor del envío
 * @param {string} params.fchResol - fecha de la Resolución SII que autoriza al emisor (AAAA-MM-DD).
 *   Es la Resolución real del contribuyente (visible en "Actualización de datos empresa
 *   autorizada" del portal SII), NO necesariamente 0/hoy — confirmar con el usuario, no asumir
 *   "0 = autorización por folios" (NATIVECODE SPA, por ejemplo, tiene Resolución N°99 de 2014).
 * @param {number} [params.nroResol=0] - número de la Resolución SII (0 solo si de verdad no hay
 *   una Resolución numerada asignada al contribuyente)
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
        tag('TmstFirmaEnv', timestamp) +
        subtotalesXml +
        `</Caratula>`
    );
}

/**
 * Arma el sobre <EnvioDTE> completo SIN FIRMAR NADA todavía (carátula + los <DTE><Documento>
 * ya construidos por `dteXml.buildDte()`, pero ninguno firmado), con todos sus atributos finales
 * (incluido xsi:schemaLocation) ya en su lugar. Ver `firmarEnvioDteEnSitio` para el porqué de
 * separar "armar" de "firmar".
 * @param {Object} params
 * @param {string} params.rutEmisor
 * @param {string} params.rutEnvia
 * @param {string} [params.rutReceptor]
 * @param {string} params.fchResol
 * @param {number} [params.nroResol]
 * @param {Array<{ documentoId: string, documentoXml: string, tipoDte: number }>} params.documentos
 * @param {string} [params.envioId]
 * @returns {{ envioXmlSinFirmar: string, envioId: string }}
 */
export function buildEnvioDteSinFirmar({ rutEmisor, rutEnvia, rutReceptor, fchResol, nroResol, documentos, envioId = 'SetDoc' }) {
    const cantidadesPorTipo = new Map();
    for (const d of documentos) cantidadesPorTipo.set(d.tipoDte, (cantidadesPorTipo.get(d.tipoDte) || 0) + 1);
    const subtotales = [...cantidadesPorTipo.entries()].map(([tipoDte, cantidad]) => ({ tipoDte, cantidad }));

    const caratulaXml = buildCaratula({ rutEmisor, rutEnvia, rutReceptor, fchResol, nroResol, subtotales });
    const dtesXml = documentos
        .map((d) => `<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">\n${d.documentoXml}\n</DTE>`)
        .join('\n');

    // xmlns declarado directamente aquí (no solo en <EnvioDTE>) -- el elemento referenciado por la
    // firma del sobre (SetDTE) debe declarar su propio namespace, no heredarlo del ancestro (ver
    // dteXml.js buildDte y verify.js §4 para el detalle del bug real que esto evita).
    const setDte = `<SetDTE xmlns="http://www.sii.cl/SiiDte" ID="${envioId}">\n${caratulaXml}\n${dtesXml}\n</SetDTE>`;

    const envioXmlSinFirmar =
        `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
        `<EnvioDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
        `xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" version="1.0">\n` +
        setDte +
        `\n</EnvioDTE>`;

    return { envioXmlSinFirmar, envioId };
}

/**
 * Firma el sobre EnvioDTE "en sitio": primero cada <Documento> (con su Signature insertada justo
 * después de él, dentro de su <DTE>), y al final el <SetDTE> completo (con su propia Signature
 * insertada justo después, dentro de <EnvioDTE>) -- todo DESPUÉS de que el documento ya está
 * ensamblado en su posición final, con `xsi:schemaLocation` y el resto de atributos de <EnvioDTE>
 * ya en su lugar.
 *
 * Por qué "en sitio" y no firmar cada pieza por separado y ensamblar después (como se hacía
 * antes): tanto el digest de cada Referencia como el propio <SignedInfo> son sensibles a
 * namespaces que existan en los ANCESTROS del elemento firmado en el momento de firmar. Si se
 * firma un <Documento> mientras todavía está aislado (solo dentro de su propio <DTE>, sin el
 * <EnvioDTE> que lo va a envolver después con `xmlns:xsi`), el digest calculado ahí NUNCA
 * coincide con el que recalcula el SII al verificar el documento ya insertado en el sobre final
 * -- causaba "Rechazado por Error en Firma" contra el SII real, incluso habiendo arreglado ya el
 * Transform (C14N en vez de enveloped-signature) y el namespace directo en cada elemento firmado.
 * Firmando en sitio, el contexto de ancestros es el mismo al firmar que al verificar, siempre.
 *
 * @param {string} envioXmlSinFirmar - resultado de `buildEnvioDteSinFirmar`
 * @param {Array<{ documentoId: string }>} documentos
 * @param {string} envioId
 * @param {Object} pemData - certificado del emisor, ver signXml.pfxToPem
 * @returns {string} el <EnvioDTE> completo, firmado
 */
export function firmarEnvioDteEnSitio(envioXmlSinFirmar, documentos, envioId, pemData) {
    let envioXml = envioXmlSinFirmar;
    for (const { documentoId } of documentos) {
        envioXml = signDocumento(envioXml, pemData, documentoId, {
            location: { reference: `//*[@ID='${documentoId}']`, action: 'after' },
        });
    }
    envioXml = signDocumento(envioXml, pemData, envioId, {
        location: { reference: `//*[@ID='${envioId}']`, action: 'after' },
    });
    return envioXml;
}
