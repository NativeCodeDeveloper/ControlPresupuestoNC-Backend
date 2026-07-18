import { buildTed } from './ted.js';
import { signDocumento } from './signXml.js';

// Generación del XML del DTE completo (Encabezado + Detalle + Timbre + Firma).
// Boleta Electrónica (39): SII "Formato Boletas Electrónicas de Ventas y Servicios" v4.00 (2023-06-01).
// Factura Electrónica (33): SII "Formato Documentos Tributarios Electrónicos" v2.5 (2026-02).
//
// Alcance actual: boleta/factura afecta simple, servicios (sin ticket de espectáculo, sin
// descuentos/recargos globales, sin referencias a otros documentos, sin exportación). Cubre lo
// que NativeCode necesita para facturar sus propios servicios y el Set de Pruebas del SII.

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (value, maxLength) => {
    const str = String(value ?? '').replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
    return maxLength ? str.slice(0, maxLength) : str;
};

const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `<${name}>${value}</${name}>\n`);

/**
 * Calcula los montos de una Boleta (39): los precios de línea vienen brutos (con IVA incluido),
 * salvo que la línea esté marcada exenta (indExe=1). MntNeto se obtiene dividiendo el bruto
 * afecto por (1 + tasa IVA) — Formato Boletas v4.00, campo 21 <PrcItem> y 29 <MntNeto>.
 */
export function computeMontosBoleta(detalle, tasaIva = 0.19) {
    let brutoAfecto = 0;
    let montoExento = 0;
    for (const linea of detalle) {
        const cantidad = Number(linea.cantidad) || 0;
        const precioUnitario = Number(linea.precioUnitario) || 0;
        const descuento = Number(linea.descuentoMonto) || 0;
        const montoLinea = Math.round(cantidad * precioUnitario - descuento);
        if (linea.indExe === 1) montoExento += montoLinea;
        else brutoAfecto += montoLinea;
    }
    const montoNeto = Math.round(brutoAfecto / (1 + tasaIva));
    const iva = brutoAfecto - montoNeto;
    const montoTotal = montoNeto + iva + montoExento;
    return { montoNeto, iva, montoExento, montoTotal };
}

/** Factura (33): precios de línea son netos (sin IVA); IVA se calcula sobre el neto. */
export function computeMontosFactura(detalle, tasaIva = 0.19) {
    let montoNeto = 0;
    let montoExento = 0;
    for (const linea of detalle) {
        const cantidad = Number(linea.cantidad) || 0;
        const precioUnitario = Number(linea.precioUnitario) || 0;
        const descuento = Number(linea.descuentoMonto) || 0;
        const montoLinea = Math.round(cantidad * precioUnitario - descuento);
        if (linea.indExe === 1) montoExento += montoLinea;
        else montoNeto += montoLinea;
    }
    const iva = Math.round(montoNeto * tasaIva);
    const montoTotal = montoNeto + iva + montoExento;
    return { montoNeto, iva, montoExento, montoTotal };
}

function buildEncabezado({ tipoDte, folio, fechaEmision, fechaVencimiento, emisor, receptor, montos, tasaIva = 19 }) {
    const esBoleta = tipoDte === 39 || tipoDte === 41;

    const idDoc =
        `<IdDoc>\n` +
        tag('TipoDTE', tipoDte) +
        tag('Folio', folio) +
        tag('FchEmis', fechaEmision) +
        (fechaVencimiento ? tag('FchVenc', fechaVencimiento) : '') +
        `</IdDoc>\n`;

    const emisorXml =
        `<Emisor>\n` +
        tag('RUTEmisor', emisor.rut) +
        tag('RznSoc', escapeXml(emisor.razonSocial, 100)) +
        tag('GiroEmis', escapeXml(emisor.giro, 80)) +
        (emisor.acteco ? tag('Acteco', emisor.acteco) : '') +
        tag('DirOrigen', escapeXml(emisor.direccion, 60)) +
        tag('CmnaOrigen', escapeXml(emisor.comuna, 20)) +
        `</Emisor>\n`;

    const receptorXml =
        `<Receptor>\n` +
        tag('RUTRecep', receptor.rut || '66666666-6') +
        tag('RznSocRecep', escapeXml(receptor.nombre, esBoleta ? 40 : 100)) +
        (!esBoleta ? tag('GiroRecep', escapeXml(receptor.giro, 40)) : '') +
        (receptor.direccion ? tag('DirRecep', escapeXml(receptor.direccion, 70)) : '') +
        (receptor.comuna ? tag('CmnaRecep', escapeXml(receptor.comuna, 20)) : '') +
        `</Receptor>\n`;

    const totalesXml =
        `<Totales>\n` +
        (montos.montoNeto ? tag('MntNeto', montos.montoNeto) : '') +
        (montos.montoExento ? tag('MntExe', montos.montoExento) : '') +
        (montos.iva ? tag('TasaIVA', tasaIva) : '') +
        (montos.iva ? tag('IVA', montos.iva) : '') +
        tag('MntTotal', montos.montoTotal) +
        `</Totales>\n`;

    return `<Encabezado>\n${idDoc}${emisorXml}${receptorXml}${totalesXml}</Encabezado>\n`;
}

function buildDetalle(detalle) {
    return detalle
        .map((linea, i) => {
            const cantidad = Number(linea.cantidad) || 0;
            const precioUnitario = Number(linea.precioUnitario) || 0;
            const descuento = Number(linea.descuentoMonto) || 0;
            const montoItem = Math.round(cantidad * precioUnitario - descuento);
            return (
                `<Detalle>\n` +
                tag('NroLinDet', i + 1) +
                (linea.indExe ? tag('IndExe', linea.indExe) : '') +
                tag('NmbItem', escapeXml(linea.nombre, 80)) +
                (linea.descripcion ? tag('DscItem', escapeXml(linea.descripcion, 1000)) : '') +
                tag('QtyItem', cantidad) +
                (linea.unidadMedida ? tag('UnmdItem', escapeXml(linea.unidadMedida, 4)) : '') +
                tag('PrcItem', precioUnitario) +
                (descuento ? tag('DescuentoMonto', descuento) : '') +
                tag('MontoItem', montoItem) +
                `</Detalle>\n`
            );
        })
        .join('');
}

/**
 * Arma y firma el DTE completo: Encabezado + Detalle + Timbre Electrónico (TED, ver ted.js) +
 * TmstFirma, envuelto en <DTE><Documento ID="...">...</Documento></DTE>, y firmado con XMLDSig
 * estándar usando el certificado del emisor (ver signXml.js).
 *
 * @param {Object} params
 * @param {33|39} params.tipoDte
 * @param {number} params.folio
 * @param {string} params.fechaEmision - AAAA-MM-DD
 * @param {Object} params.emisor - { rut, razonSocial, giro, direccion, comuna, acteco }
 * @param {Object} params.receptor - { rut, nombre, giro, direccion, comuna }
 * @param {Array}  params.detalle - [{ nombre, descripcion, cantidad, unidadMedida, precioUnitario, descuentoMonto, indExe }]
 * @param {Object} params.caf - resultado de ted.parseCaf(cafXml)
 * @param {{ certPem: string, privateKeyPem: string, certificate: import('node-forge').pki.Certificate }} params.pemData
 * @param {string} [params.fechaVencimiento]
 * @returns {{ documentoId: string, montos: object, dteXmlFirmado: string }}
 */
export function buildYFirmarDte({ tipoDte, folio, fechaEmision, fechaVencimiento, emisor, receptor, detalle, caf, pemData }) {
    const montos = tipoDte === 39 || tipoDte === 41 ? computeMontosBoleta(detalle) : computeMontosFactura(detalle);
    const timestamp = new Date().toISOString().slice(0, 19);
    const documentoId = `F${String(folio).padStart(10, '0')}T${tipoDte}`;

    const ted = buildTed({
        caf,
        folio,
        fechaEmision,
        rutReceptor: receptor.rut || '66666666-6',
        razonSocialReceptor: receptor.nombre,
        montoTotal: montos.montoTotal,
        primerItem: detalle[0]?.nombre || '',
        timestamp,
    });

    const encabezado = buildEncabezado({ tipoDte, folio, fechaEmision, fechaVencimiento, emisor, receptor, montos });
    const detalleXml = buildDetalle(detalle);

    const documentoXml =
        `<Documento ID="${documentoId}">\n` +
        encabezado +
        detalleXml +
        `${ted}\n` +
        tag('TmstFirma', timestamp) +
        `</Documento>`;

    const dteXml =
        `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
        `<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">\n` +
        documentoXml +
        `\n</DTE>`;

    const dteXmlFirmado = signDocumento(dteXml, pemData, documentoId);
    return { documentoId, montos, dteXmlFirmado };
}
