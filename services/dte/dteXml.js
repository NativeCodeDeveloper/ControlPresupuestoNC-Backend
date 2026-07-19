import { buildTed } from './ted.js';
import { signDocumento } from './signXml.js';

// Generación del XML del DTE completo (Encabezado + Detalle + Timbre + Firma).
// Boleta Electrónica (39): SII "Formato Boletas Electrónicas de Ventas y Servicios" v4.00 (2023-06-01).
// Factura Electrónica (33) y Nota de Crédito/Débito (61/56): SII "Formato Documentos Tributarios
// Electrónicos" v2.5 (2026-02).
//
// Alcance actual: boleta/factura afecta simple, servicios (sin ticket de espectáculo, sin
// exportación); factura además soporta descuento/recargo global (<DscRcGlobal>, solo sobre el
// neto afecto) y Nota de Crédito/Débito con referencia a otro documento (<Referencia>). Cubre lo
// que NativeCode necesita para facturar sus propios servicios y el Set de Pruebas del SII
// (SET BASICO). Sin Guía de Despacho, Factura Exenta, Exportación, Liquidación ni Factura de
// Compra todavía — ver INTEGRACION_DTE.md §5.11.

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
// Trunca antes de escapar (no al revés) para no cortar una entidad XML a la mitad.
const escapeXml = (value, maxLength) => {
    const str = String(value ?? '');
    const truncated = maxLength ? str.slice(0, maxLength) : str;
    return truncated.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
};

const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `<${name}>${value}</${name}>\n`);

// Normaliza un RUT chileno al formato que exige el SII (cuerpo numérico + guion + DV, sin
// puntos). Defensivo: el frontend ya normaliza, pero el backend no debe confiar en eso —
// cualquier llamador (frontend, script, prueba manual) podría mandar un RUT con puntos.
function normalizeRut(value) {
    if (!value) return value;
    const clean = String(value).replace(/[.\s]/g, '').toUpperCase();
    const match = clean.match(/^(\d{1,8})-?([\dK])$/);
    return match ? `${match[1]}-${match[2]}` : clean;
}

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

/**
 * Factura (33) / Nota de Crédito/Débito (61/56): precios de línea son netos (sin IVA); IVA se
 * calcula sobre el neto. `descuentosGlobales` (opcional, default sin efecto) aplica cada ajuste
 * sobre el neto afecto acumulado, antes del IVA — Formato DTE v2.5 <DscRcGlobal>. Ej.: Set de
 * Pruebas SII caso 4959502-4, "descuento global 15% solo sobre ítems afectos".
 * @param {Array} descuentosGlobales - [{ tpoMov: 'D'|'R', tpoValor: '%'|'$', valorDR }]
 */
export function computeMontosFactura(detalle, tasaIva = 0.19, descuentosGlobales = []) {
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
    for (const global of descuentosGlobales) {
        const valor = Number(global.valorDR) || 0;
        const signo = global.tpoMov === 'R' ? 1 : -1;
        const ajuste = global.tpoValor === '$' ? valor : Math.round(montoNeto * (valor / 100));
        montoNeto += signo * ajuste;
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
 * Descuento/recargo global (Formato DTE v2.5 <DscRcGlobal>) — cero o más bloques <DR>. Devuelve
 * '' si no hay descuentos globales, para no alterar el XML de documentos que no los usan.
 * @param {Array} descuentosGlobales - [{ tpoMov: 'D'|'R', glosaDR, tpoValor: '%'|'$', valorDR, indExeDR }]
 */
function buildDscRcGlobal(descuentosGlobales) {
    if (!descuentosGlobales || descuentosGlobales.length === 0) return '';
    const drs = descuentosGlobales
        .map((g, i) =>
            `<DR>\n` +
            tag('NroLinDR', i + 1) +
            tag('TpoMov', g.tpoMov) +
            (g.glosaDR ? tag('GlosaDR', escapeXml(g.glosaDR, 40)) : '') +
            tag('TpoValor', g.tpoValor) +
            tag('ValorDR', g.valorDR) +
            (g.indExeDR ? tag('IndExeDR', g.indExeDR) : '') +
            `</DR>\n`
        )
        .join('');
    return `<DscRcGlobal>\n${drs}</DscRcGlobal>\n`;
}

/**
 * Referencia a otro DTE (Formato DTE v2.5 <Referencia>) — usada por Nota de Crédito/Débito (61/56)
 * para apuntar al documento que corrigen/anulan. Devuelve '' si no hay referencias.
 * @param {Array} referencias - [{ tpoDocRef, folioRef, fchRef, codRef, razonRef }]
 */
function buildReferencia(referencias) {
    if (!referencias || referencias.length === 0) return '';
    return referencias
        .map((r, i) =>
            `<Referencia>\n` +
            tag('NroLinRef', i + 1) +
            tag('TpoDocRef', r.tpoDocRef) +
            tag('FolioRef', r.folioRef) +
            tag('FchRef', r.fchRef) +
            (r.codRef !== undefined && r.codRef !== null && r.codRef !== '' ? tag('CodRef', r.codRef) : '') +
            (r.razonRef ? tag('RazonRef', escapeXml(r.razonRef, 90)) : '') +
            `</Referencia>\n`
        )
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
 * @param {Array}  [params.descuentosGlobales] - ver `computeMontosFactura` (ignorado en Boleta)
 * @param {Array}  [params.referencias] - [{ tpoDocRef, folioRef, fchRef, codRef, razonRef }], para Nota de Crédito/Débito (61/56)
 * @param {Object} params.caf - resultado de ted.parseCaf(cafXml)
 * @param {{ certPem: string, privateKeyPem: string, certificate: import('node-forge').pki.Certificate }} params.pemData
 * @param {string} [params.fechaVencimiento]
 * @returns {{ documentoId: string, montos: object, dteXmlFirmado: string }}
 */
export function buildYFirmarDte({ tipoDte, folio, fechaEmision, fechaVencimiento, emisor, receptor, detalle, descuentosGlobales = [], referencias = [], caf, pemData }) {
    if (!Array.isArray(detalle)) {
        throw new Error('El documento requiere un arreglo de detalle');
    }
    if (detalle.length === 0 && referencias.length === 0) {
        // Una Nota de Crédito/Débito que solo corrige texto (ej. "corrige giro del receptor",
        // "anula factura") puede no traer líneas de detalle, siempre que traiga una referencia.
        throw new Error('El documento requiere al menos una línea de detalle, o una referencia (Nota de Crédito/Débito)');
    }
    if (!emisor?.rut || !emisor?.razonSocial) {
        throw new Error('Faltan datos del emisor (RUT y razón social son obligatorios)');
    }
    if (caf.tipoDte !== tipoDte) {
        // El TED toma el tipo de documento del propio CAF (ted.js), no del parámetro tipoDte —
        // si no coinciden, el documento quedaría autoinconsistente (Encabezado dice un tipo,
        // Timbre dice otro) sin que nada lo detecte.
        throw new Error(`El CAF cargado es para tipo ${caf.tipoDte}, pero se pidió emitir tipo ${tipoDte}`);
    }

    const emisorNorm = { ...emisor, rut: normalizeRut(emisor.rut) };
    const receptorNorm = { ...receptor, rut: normalizeRut(receptor.rut) || '66666666-6' };

    const montos = tipoDte === 39 || tipoDte === 41
        ? computeMontosBoleta(detalle)
        : computeMontosFactura(detalle, 0.19, descuentosGlobales);
    const timestamp = new Date().toISOString().slice(0, 19);
    const documentoId = `F${String(folio).padStart(10, '0')}T${tipoDte}`;

    const ted = buildTed({
        caf,
        folio,
        fechaEmision,
        rutReceptor: receptorNorm.rut,
        razonSocialReceptor: receptorNorm.nombre,
        montoTotal: montos.montoTotal,
        primerItem: detalle[0]?.nombre || referencias[0]?.razonRef || '',
        timestamp,
    });

    const encabezado = buildEncabezado({ tipoDte, folio, fechaEmision, fechaVencimiento, emisor: emisorNorm, receptor: receptorNorm, montos });
    const detalleXml = buildDetalle(detalle);
    const dscRcGlobalXml = buildDscRcGlobal(descuentosGlobales);
    const referenciaXml = buildReferencia(referencias);

    const documentoXml =
        // xmlns declarado directamente aquí (no solo en <DTE>) -- confirmado bug real de
        // xml-crypto (2026-07-19): cuando el elemento referenciado por la firma hereda el
        // namespace de un ancestro en vez de declararlo él mismo, el digest calculado al firmar
        // no coincide con el que se recalcula al verificar ("Rechazado por Error en Firma" en el
        // SII real) -- independiente de si se usa C14N normal o exclusivo. Ver services/dte/verify.js §4.
        `<Documento xmlns="http://www.sii.cl/SiiDte" ID="${documentoId}">\n` +
        encabezado +
        detalleXml +
        dscRcGlobalXml +
        referenciaXml +
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
