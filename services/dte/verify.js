/**
 * Verificación del motor DTE nativo, sin CAF ni certificado real, sin tocar el SII.
 * Corre con: node services/dte/verify.js
 *
 * 1. Canonicalización del TED contra el ejemplo textual exacto del Instructivo Técnico del SII
 *    (28/10/2021, Anexo 2.4) — input con saltos de línea/tabs → output canónico esperado.
 * 2. Construcción de <DD> del TED — verifica orden y presencia de campos (RE,TD,F,FE,RR,RSR,MNT,IT1,CAF,TSTED).
 * 3. Firma/verificación del TED (SHA1withRSA) con un par de llaves de prueba — round-trip.
 * 4. Firma/verificación XMLDSig del DTE completo con un certificado autofirmado de prueba — round-trip.
 * 5. Pipeline completo (CASO-1 del Set de Pruebas real) — build + firma + PDF417, sin errores.
 * 6. Regresión: truncar-antes-de-escapar (no cortar entidades XML a la mitad) y validaciones de
 *    entrada de buildYFirmarDte (detalle vacío, emisor incompleto).
 * 7. Regresión: parseUploadResponse() no debe confundir "sin <STATUS> en la respuesta" (ej. la
 *    página HTML de error genérica que el SII devuelve cuando el archivo no pasa su chequeo
 *    inicial) con "<STATUS>0</STATUS>" (aceptado) — Number(null) da 0 en JS, así que esto se
 *    verifica explícitamente contra la respuesta real capturada en la primera prueba en vivo.
 * 8. Regresión + nuevo alcance: descuento/recargo global (<DscRcGlobal>) y Nota de Crédito con
 *    Referencia (<Referencia>), agregados para el nuevo Set de Pruebas SII (SET BASICO, casos
 *    4959502-1 a 8) — confirma que una Factura simple no cambia su XML, que el descuento global
 *    calcula bien el neto/IVA, y que una NC sin líneas de detalle (solo referencia) arma y firma
 *    correctamente.
 * 9. Regresión — 3 bugs reales encontrados en la primera prueba real de envío (Boleta caso 1,
 *    CAF real, 2026-07-19), ninguno detectable por las secciones anteriores porque `verify.js`
 *    nunca había probado `envioDte.js` contra el validador de schema del SII:
 *    a) `<FchResol>` es obligatorio en la Carátula (incluso con NroResol=0/autorización por
 *       folios) — `buildCaratula` ahora lanza si no se pasa.
 *    b) dentro de `<SubTotDTE>` el tag correcto es `<TpoDTE>`, no `<TipoDTE>` (ese nombre solo es
 *       correcto dentro de `<IdDoc>` del propio DTE).
 *    c) cada DTE trae su propio prólogo `<?xml ...?>`, que no puede quedar anidado dentro del
 *       sobre `<EnvioDTE>` — `buildYFirmarEnvioDte` ahora lo quita antes de insertarlo.
 */
import crypto from 'crypto';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { canonicalizeSiiTed, buildTedDatos, signTed, verifyTed, escapeTedText } from './ted.js';
import { pfxToPem, signDocumento } from './signXml.js';
import { buildDte, buildYFirmarDte, computeMontosBoleta, computeMontosFactura } from './dteXml.js';
import { buildCaratula, buildEnvioDteSinFirmar, firmarEnvioDteEnSitio } from './envioDte.js';
import { generarTimbrePdf417 } from './pdf417.js';
import { parseUploadResponse, xmlComoBytesIso88591 } from './siiClient.js';

// Genera un certificado autofirmado + llave, empaquetado como .pfx en memoria, para probar los
// flujos de firma sin depender del certificado real del usuario.
function generarPfxDePrueba() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const attrs = [{ name: 'commonName', value: 'NativeCode Test' }, { name: 'countryName', value: 'CL' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha1.create());
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'testpass', { algorithm: '3des' });
    const pfxBuffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
    return pfxToPem(pfxBuffer, 'testpass');
}

// Arma un CAF sintético pero criptográficamente real (llaves RSA generadas en el momento), para
// poder firmar y verificar el TED sin depender de un CAF real del SII.
function generarCafDePrueba({ rutEmisor = '78184828-K', tipoDte = 39, folioDesde = 1, folioHasta = 5 } = {}) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    const cafXmlOriginal =
        `<CAF version="1.0"><DA><RE>${rutEmisor}</RE><RS>NATIVECODE SPA</RS><TD>${tipoDte}</TD>` +
        `<RNG><D>${folioDesde}</D><H>${folioHasta}</H></RNG><FA>2026-07-18</FA>` +
        `<RSAPK><M>TEST</M><E>TEST</E></RSAPK><IDK>100</IDK></DA>` +
        `<FRMA algoritmo="SHA1withRSA">TESTFIRMASII</FRMA></CAF>`;
    return { rutEmisor, tipoDte, folioDesde, folioHasta, cafXmlOriginal, rsaPrivateKeyPem: privateKey, rsaPublicKeyPem: publicKey };
}

let failed = 0;
function check(name, condition, detail = '') {
    if (condition) {
        console.log(`  ✓ ${name}`);
    } else {
        failed++;
        console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

// ── 1. Canonicalización contra el ejemplo del instructivo (Anexo 2.4, pág. 20-21) ──
console.log('\n[1] Canonicalización del TED (ejemplo oficial del instructivo)');
{
    const TAB = '\t';
    const NL = '\n';
    const input =
        `<TED version="1.0">${NL}` +
        `${TAB}<DD>${NL}` +
        `${TAB}${TAB}<RE>11111111-1</RE>${NL}` +
        `${TAB}${TAB}<TD>33</TD>${NL}` +
        `${TAB}${TAB}<F>122</F>${NL}` +
        `${TAB}${TAB}<FE>2002-06-11</FE>${NL}` +
        `${TAB}${TAB}<RR>12345678-5</RR>${NL}` +
        `${TAB}${TAB}<RSR>Empresas A&amp;B Limitada</RSR>${NL}` +
        `${TAB}${TAB}<MNT>24365</MNT>${NL}` +
        `${TAB}${TAB}<IT1>Cajón de Manzanas</IT1>${NL}` +
        `${TAB}${TAB}<CAF version="1.0">${NL}` +
        `${TAB}${TAB}<DA>${NL}` +
        `${TAB}${TAB}${TAB}<RE>11111111-1</RE>${NL}` +
        `${TAB}${TAB}${TAB}<RS>Ejemplo S.A.</RS>${NL}` +
        `${TAB}${TAB}${TAB}<TD>33</TD>${NL}` +
        `${TAB}${TAB}${TAB}<RNG>${NL}` +
        `${TAB}${TAB}${TAB}${TAB}<D>125</D>${NL}` +
        `${TAB}${TAB}${TAB}${TAB}<H>160</H>${NL}` +
        `${TAB}${TAB}${TAB}</RNG>${NL}` +
        `${TAB}${TAB}${TAB}<FA>2002-05-14</FA>${NL}` +
        `${TAB}${TAB}${TAB}<RSAPK>${NL}` +
        `${TAB}${TAB}${TAB}${TAB}<M>zf/B...cwx</M>${NL}` +
        `${TAB}${TAB}${TAB}${TAB}<E>QBcs</E>${NL}` +
        `${TAB}${TAB}${TAB}</RSAPK>${NL}` +
        `${TAB}${TAB}${TAB}<IDK>3</IDK>${NL}` +
        `${TAB}${TAB}</DA>${NL}` +
        `${TAB}${TAB}<FRMA>yTfHE...ydmh9fgsj3rv86=</FRMA>${NL}` +
        `${TAB}</CAF>${NL}` +
        `${TAB}<TSTED>2002-06-11T07:34:15</TSTED>${NL}` +
        `${TAB}</DD>${NL}` +
        `${TAB}<FRMT algoritmo="SHA1withRSA">GkdhiwT5a4...09UjhGfsR7l/=</FRMT>${NL}` +
        `</TED>${NL}`;

    const expectedDD =
        `<DD><RE>11111111-1</RE><TD>33</TD><F>122</F><FE>2002-06-11</FE><RR>12345678-5</RR>` +
        `<RSR>Empresas A&amp;B Limitada</RSR><MNT>24365</MNT><IT1>Cajón de Manzanas</IT1>` +
        `<CAF version="1.0"><DA><RE>11111111-1</RE><RS>Ejemplo S.A.</RS><TD>33</TD>` +
        `<RNG><D>125</D><H>160</H></RNG><FA>2002-05-14</FA><RSAPK><M>zf/B...cwx</M><E>QBcs</E>` +
        `</RSAPK><IDK>3</IDK></DA><FRMA>yTfHE...ydmh9fgsj3rv86=</FRMA></CAF>` +
        `<TSTED>2002-06-11T07:34:15</TSTED></DD>`;

    const canonical = canonicalizeSiiTed(input);
    const canonicalDD = canonical.match(/<DD>[\s\S]*<\/DD>/)[0];
    check('canonicalizeSiiTed() reproduce exactamente el <DD> canónico del instructivo', canonicalDD === expectedDD,
        canonicalDD !== expectedDD ? `\n    obtenido: ${canonicalDD}\n    esperado: ${expectedDD}` : '');
}

// ── 2. Construcción de <DD> — orden y presencia de campos ──
console.log('\n[2] Construcción de <DD> del TED (buildTedDatos)');
{
    const cafSintetico = {
        rutEmisor: '78184828-K',
        tipoDte: 39,
        folioDesde: 1,
        folioHasta: 5,
        cafXmlOriginal: '<CAF version="1.0"><DA><RE>78184828-K</RE><RS>NATIVECODE SPA</RS><TD>39</TD><RNG><D>1</D><H>5</H></RNG><FA>2026-07-18</FA><RSAPK><M>TEST</M><E>TEST</E></RSAPK><IDK>100</IDK></DA><FRMA algoritmo="SHA1withRSA">TESTFIRMA</FRMA></CAF>',
    };
    const dd = buildTedDatos({
        caf: cafSintetico,
        folio: 1,
        fechaEmision: '2026-07-18',
        rutReceptor: '66666666-6',
        razonSocialReceptor: 'Cliente de Prueba',
        montoTotal: 19900,
        primerItem: 'Cambio de aceite',
        timestamp: '2026-07-18T10:00:00',
    });
    const order = ['RE', 'TD', 'F', 'FE', 'RR', 'RSR', 'MNT', 'IT1', 'CAF', 'TSTED'];
    const indices = order.map((t) => dd.indexOf(`<${t}`));
    const ordered = indices.every((idx, i) => i === 0 || idx > indices[i - 1]);
    check('todos los campos están presentes', indices.every((i) => i !== -1));
    check('el orden de los campos es RE,TD,F,FE,RR,RSR,MNT,IT1,CAF,TSTED', ordered);
    check('rechaza folio fuera de rango del CAF', (() => {
        try {
            buildTedDatos({ caf: cafSintetico, folio: 999, fechaEmision: '2026-07-18', rutReceptor: '1-9', razonSocialReceptor: 'x', montoTotal: 1, primerItem: 'x', timestamp: 't' });
            return false;
        } catch {
            return true;
        }
    })());
}

// ── 3. Firma/verificación del TED (SHA1withRSA, llave del CAF) ──
console.log('\n[3] Firma y verificación del TED (round-trip, llaves de prueba)');
{
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    const datos = '<DD><RE>78184828-K</RE><TD>39</TD><F>1</F></DD>';
    const firma = signTed(datos, privateKey);
    check('signTed() produce una firma base64 no vacía', typeof firma === 'string' && firma.length > 0);
    check('verifyTed() valida la firma con la llave pública correspondiente', verifyTed(datos, firma, publicKey));
    check('verifyTed() rechaza una firma sobre datos alterados', !verifyTed(datos + 'x', firma, publicKey));
}

// ── 4. Firma XMLDSig del DTE completo con certificado autofirmado de prueba ──
console.log('\n[4] Firma XMLDSig del DTE completo (round-trip, certificado autofirmado)');
{
    const pemData = generarPfxDePrueba();
    check('pfxToPem() extrae llave privada y certificado', Boolean(pemData.privateKeyPem && pemData.certPem));

    // El namespace va declarado directamente en <Documento> (el elemento referenciado por la
    // firma), no solo en el <DTE> ancestro -- ver el bug real explicado abajo.
    const xml = '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0"><Documento xmlns="http://www.sii.cl/SiiDte" ID="TESTDOC1"><Encabezado><IdDoc><TipoDTE>39</TipoDTE></IdDoc></Encabezado></Documento></DTE>';
    const signedXml = signDocumento(xml, pemData, 'TESTDOC1');
    check('signDocumento() inserta un elemento <Signature>', signedXml.includes('<Signature'));

    const transformCount = (signedXml.match(/<Transform /g) || []).length;
    check('signDocumento() usa un único <Transform> por Reference',
        transformCount === 1, `se encontraron ${transformCount} — el schema del SII rechaza más de uno (confirmado 2026-07-19)`);
    // El transform debe ser C14N, NO enveloped-signature -- confirmado contra el "DTE de ejemplo"
    // oficial del SII (manual_certificacion.pdf Anexo 5.1): ahí <Signature> va como hermano de
    // <Documento> (no anidado), así que nunca hace falta "envelope-strip" -- solo canonicalizar
    // de verdad. Usar enveloped-signature aquí no canonicaliza (xml-crypto solo canonicaliza si
    // el transform declarado es un algoritmo de C14N/EXC-C14N), causando digests que nunca
    // coinciden con la verificación real del SII ("Rechazado por Error en Firma", 2026-07-19).
    check('el Transform declarado es C14N (no enveloped-signature)',
        signedXml.includes('<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"') &&
        !signedXml.includes('enveloped-signature'));

    const verifier = new SignedXml({ publicCert: pemData.certPem });
    let isValid = false;
    try {
        const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
        const signatureNode = xpath.select(
            "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
            doc
        )[0];
        verifier.loadSignature(signatureNode);
        isValid = verifier.checkSignature(signedXml);
    } catch (e) {
        console.log(`    (error verificando: ${e.message})`);
    }
    check('la firma XMLDSig es válida contra el certificado (xml-crypto.checkSignature)', isValid);

    // NOTA — bug real de firma encontrado contra el SII real (2026-07-19, Factura caso 1, 3
    // folios reales consumidos antes de encontrar la causa completa): "Rechazado por Error en
    // Firma". Causas encontradas, en orden:
    // 1) el Transform declarado era enveloped-signature en vez de C14N -- xml-crypto solo
    //    canonicaliza de verdad cuando el Transform es un algoritmo de canonicalización, así que
    //    el digest se calculaba sobre una serialización cruda del DOM. Arreglado (ver arriba).
    // 2) incluso con el Transform correcto, REINSERTAR un documento ya firmado dentro de un
    //    <EnvioDTE> que agrega un namespace nuevo (`xmlns:xsi`/`xsi:schemaLocation`, que el SII
    //    exige -- STATUS 7 "Invalid Schema Name" sin él) invalida tanto el digest de la
    //    Referencia como el propio <SignedInfo>, con C14N normal o exclusivo: no hay forma de
    //    firmar aislado y reinsertar después de forma segura si el contexto final agrega
    //    namespaces. La solución real fue dejar de reinsertar: `buildDte()` arma el Documento SIN
    //    firmar, `buildEnvioDteSinFirmar()` ensambla el sobre completo (con xsi:schemaLocation ya
    //    puesto) sin firmar nada, y `firmarEnvioDteEnSitio()` firma Documento y SetDTE ya en su
    //    posición final -- ver §9 para la verificación criptográfica real de este flujo, que es
    //    el que usa producción (dteService.js). `buildYFirmarDte()` (probado arriba) sigue
    //    firmando standalone para uso aislado, pero **no debe reinsertarse** en otro documento
    //    después de firmado -- por diseño, no es un caso soportado.
}

// ── 5. Pipeline completo con el CASO-1 real del Set de Pruebas del SII ──
console.log('\n[5] Pipeline completo — CASO-1 del Set de Pruebas (Cambio de aceite + Alineación y balanceo)');
{
    const pemData = generarPfxDePrueba();
    const caf = generarCafDePrueba({ tipoDte: 39, folioDesde: 1, folioHasta: 5 });

    let resultado;
    let errorPipeline = null;
    try {
        resultado = buildYFirmarDte({
            tipoDte: 39,
            folio: 1,
            fechaEmision: '2026-07-18',
            emisor: {
                rut: caf.rutEmisor,
                razonSocial: 'NATIVECODE SPA',
                giro: 'Desarrollo de software',
                direccion: 'Las Canarias PC 2',
                comuna: 'Ñuble',
            },
            receptor: { rut: '66666666-6', nombre: 'Cliente de Prueba' },
            detalle: [
                { nombre: 'Cambio de aceite', cantidad: 1, precioUnitario: 19900 },
                { nombre: 'Alineación y balanceo', cantidad: 1, precioUnitario: 9900 },
            ],
            caf,
            pemData,
        });
    } catch (e) {
        errorPipeline = e;
    }

    check('buildYFirmarDte() no lanza error con datos reales del CASO-1', !errorPipeline, errorPipeline?.stack);
    if (resultado) {
        const montosEsperados = computeMontosBoleta([
            { cantidad: 1, precioUnitario: 19900 },
            { cantidad: 1, precioUnitario: 9900 },
        ]);
        check('el monto total calculado es 19900 + 9900 = 29800 (bruto, boleta)', resultado.montos.montoTotal === 29800,
            `obtenido ${resultado.montos.montoTotal}`);
        check('montoNeto + IVA + exento reconstruyen el total',
            montosEsperados.montoNeto + montosEsperados.iva + montosEsperados.montoExento === montosEsperados.montoTotal);
        check('el XML firmado contiene el <TED>', resultado.dteXmlFirmado.includes('<TED version="1.0">'));
        check('el XML firmado contiene la <Signature> del documento', resultado.dteXmlFirmado.includes('<Signature'));

        try {
            const tedMatch = resultado.dteXmlFirmado.match(/<TED version="1.0">[\s\S]*?<\/TED>/)[0];
            const png = await generarTimbrePdf417(tedMatch);
            check('generarTimbrePdf417() produce un PNG no vacío', Buffer.isBuffer(png) && png.length > 0);
        } catch (e) {
            check('generarTimbrePdf417() produce un PNG no vacío', false, e.message);
        }
    } else {
        check('montoTotal / TED / Signature / PDF417 (omitidos por error previo)', false);
    }
}

// ── 6. Regresión: truncado seguro de entidades XML + validaciones de entrada ──
console.log('\n[6] Regresión — truncado seguro y validaciones de entrada');
{
    // "Empresa&B" (9 chars) truncado a 8 no debe cortar la entidad "&amp;" a la mitad.
    const resultado = escapeTedText('Empresa&Bcia', 8);
    check('escapeTedText trunca antes de escapar (no corta entidades XML)', !/&[a-z]*$/i.test(resultado) || resultado.endsWith(';') || !resultado.includes('&'),
        `obtenido: "${resultado}"`);
    check('escapeTedText no produce una entidad incompleta como salida', resultado === 'Empresa' || /^[^&]*(&(amp|lt|gt|quot|apos);)*$/.test(resultado),
        `obtenido: "${resultado}"`);

    const cafSintetico = generarCafDePrueba();
    const pemData = generarPfxDePrueba();

    check('buildYFirmarDte rechaza detalle vacío', (() => {
        try {
            buildYFirmarDte({ tipoDte: 39, folio: 1, fechaEmision: '2026-07-18', emisor: { rut: cafSintetico.rutEmisor, razonSocial: 'X' }, receptor: {}, detalle: [], caf: cafSintetico, pemData });
            return false;
        } catch { return true; }
    })());

    check('buildYFirmarDte rechaza emisor sin razón social', (() => {
        try {
            buildYFirmarDte({ tipoDte: 39, folio: 1, fechaEmision: '2026-07-18', emisor: { rut: cafSintetico.rutEmisor }, receptor: {}, detalle: [{ nombre: 'x', cantidad: 1, precioUnitario: 100 }], caf: cafSintetico, pemData });
            return false;
        } catch { return true; }
    })());

    const cafFactura = generarCafDePrueba({ tipoDte: 33 });
    check('buildYFirmarDte normaliza un RUT de receptor con puntos', (() => {
        const { dteXmlFirmado } = buildYFirmarDte({
            tipoDte: 33, folio: 1, fechaEmision: '2026-07-18',
            emisor: { rut: cafFactura.rutEmisor, razonSocial: 'NATIVECODE SPA' },
            receptor: { rut: '12.345.678-5', nombre: 'Cliente Con Puntos' },
            detalle: [{ nombre: 'Servicio', cantidad: 1, precioUnitario: 1000 }],
            caf: cafFactura, pemData,
        });
        return dteXmlFirmado.includes('<RUTRecep>12345678-5</RUTRecep>') && !dteXmlFirmado.includes('12.345.678-5');
    })());

    check('buildYFirmarDte rechaza un CAF de tipo distinto al solicitado', (() => {
        try {
            buildYFirmarDte({
                tipoDte: 33, folio: 1, fechaEmision: '2026-07-18',
                emisor: { rut: cafSintetico.rutEmisor, razonSocial: 'NATIVECODE SPA' },
                receptor: { nombre: 'x' },
                detalle: [{ nombre: 'x', cantidad: 1, precioUnitario: 100 }],
                caf: cafSintetico, // es de tipo 39, se pide emitir 33
                pemData,
            });
            return false;
        } catch { return true; }
    })());
}

// ── 7. Regresión: parseUploadResponse no debe confundir "sin STATUS" con "STATUS=0" ──
console.log('\n[7] Regresión — parseo de la respuesta de enviarSetDte (bug real encontrado en la primera prueba en vivo)');
{
    // Respuesta HTML real capturada de maullin.sii.cl al enviar un sobre con CAF sintético
    // (no autorizado) — el SII rechaza antes de asignar STATUS/TRACKID, sin devolver el XML
    // <RECEPCIONDTE> documentado. Number(extractTag(...) ?? null) daba 0 antes del fix, lo que
    // habría marcado como "enviado" un envío que en realidad nunca fue procesado.
    const htmlErrorReal = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html><body><p>HA OCURRIDO UN ERROR EN EL UPLOAD DEL ARCHIVO DE DOCUMENTOS TRIBUTARIOS ELECTRONICOS.</p></body></html>`;
    const { status, trackId } = parseUploadResponse(htmlErrorReal);
    check('parseUploadResponse: respuesta sin <STATUS> da status=null (no 0)', status === null, `obtenido: ${status}`);
    check('parseUploadResponse: respuesta sin <TRACKID> da trackId=null', trackId === null);

    const xmlExitoso = '<RECEPCIONDTE><STATUS>0</STATUS><TRACKID>123456789</TRACKID></RECEPCIONDTE>';
    const exitoso = parseUploadResponse(xmlExitoso);
    check('parseUploadResponse: STATUS=0 real se distingue de "sin STATUS"', exitoso.status === 0, `obtenido: ${exitoso.status}`);
    check('parseUploadResponse: extrae el TRACKID cuando sí viene', exitoso.trackId === '123456789', `obtenido: ${exitoso.trackId}`);
}

// ── 8. Nuevo alcance — descuento/recargo global + Referencia (Nota de Crédito), Set SII 4959502 ──
console.log('\n[8] Descuento/recargo global (<DscRcGlobal>) + Referencia (<Referencia>) — SET BASICO 4959502');
{
    const pemData = generarPfxDePrueba();
    const cafFactura = generarCafDePrueba({ tipoDte: 33, folioDesde: 1, folioHasta: 10 });
    const cafNc = generarCafDePrueba({ tipoDte: 61, folioDesde: 1, folioHasta: 10 });
    const emisorTest = { rut: cafFactura.rutEmisor, razonSocial: 'NATIVECODE SPA', giro: 'Desarrollo de software' };
    const receptorTest = { rut: '11111111-1', nombre: 'Cliente Test' };

    // 8.1 — Regresión: Factura simple (sin descuentosGlobales/referencias) no debe cambiar.
    const facturaSimple = buildYFirmarDte({
        tipoDte: 33, folio: 1, fechaEmision: '2026-07-18', emisor: emisorTest, receptor: receptorTest,
        detalle: [
            { nombre: 'Cajón', cantidad: 146, precioUnitario: 2237 },
            { nombre: 'Relleno', cantidad: 62, precioUnitario: 3695 },
        ],
        caf: cafFactura, pemData,
    });
    check('Factura simple sin descuento global no genera <DscRcGlobal>', !facturaSimple.dteXmlFirmado.includes('<DscRcGlobal>'));
    check('Factura simple sin referencias no genera <Referencia>', !facturaSimple.dteXmlFirmado.includes('<Referencia>'));

    // 8.2 — Caso 4959502-4: descuento global 15% solo sobre ítems afectos.
    const detalleCaso4 = [
        { nombre: 'Ítem 1 afecto', cantidad: 252, precioUnitario: 3846 },
        { nombre: 'Ítem 2 afecto', cantidad: 107, precioUnitario: 4373 },
        { nombre: 'Ítem 3 servicio exento', cantidad: 2, precioUnitario: 6801, indExe: 1 },
    ];
    const descuentoGlobalCaso4 = [{ tpoMov: 'D', tpoValor: '%', valorDR: 15, glosaDR: 'Descuento global ítems afectos' }];
    const montosCaso4 = computeMontosFactura(detalleCaso4, 0.19, descuentoGlobalCaso4);
    const netoAfectoSinDescuento = 252 * 3846 + 107 * 4373;
    const netoEsperado = netoAfectoSinDescuento - Math.round(netoAfectoSinDescuento * 0.15);
    const ivaEsperado = Math.round(netoEsperado * 0.19);
    check('descuento global 15% reduce el neto afecto antes del IVA', montosCaso4.montoNeto === netoEsperado,
        `obtenido ${montosCaso4.montoNeto}, esperado ${netoEsperado}`);
    check('el IVA se calcula sobre el neto ya descontado', montosCaso4.iva === ivaEsperado,
        `obtenido ${montosCaso4.iva}, esperado ${ivaEsperado}`);
    check('montoNeto + IVA + exento reconstruyen el total (con descuento global)',
        montosCaso4.montoNeto + montosCaso4.iva + montosCaso4.montoExento === montosCaso4.montoTotal);

    const facturaConDescuentoGlobal = buildYFirmarDte({
        tipoDte: 33, folio: 2, fechaEmision: '2026-07-18', emisor: emisorTest, receptor: receptorTest,
        detalle: detalleCaso4, descuentosGlobales: descuentoGlobalCaso4, caf: cafFactura, pemData,
    });
    check('el XML incluye <DscRcGlobal> con el descuento aplicado',
        facturaConDescuentoGlobal.dteXmlFirmado.includes('<DscRcGlobal>') && facturaConDescuentoGlobal.dteXmlFirmado.includes('<TpoValor>%</TpoValor>'));

    // 8.3 — Caso 4959502-5: Nota de Crédito que solo corrige texto, sin líneas de detalle, con Referencia.
    let errorNcSinDetalle = null;
    let ncSinDetalle;
    try {
        ncSinDetalle = buildYFirmarDte({
            tipoDte: 61, folio: 1, fechaEmision: '2026-07-18', emisor: emisorTest, receptor: receptorTest,
            detalle: [],
            referencias: [{ tpoDocRef: 33, folioRef: 1, fchRef: '2026-07-18', codRef: 2, razonRef: 'Corrige giro del receptor' }],
            caf: cafNc, pemData,
        });
    } catch (e) {
        errorNcSinDetalle = e;
    }
    check('una Nota de Crédito con referencia y sin líneas de detalle no lanza error', !errorNcSinDetalle, errorNcSinDetalle?.message);
    if (ncSinDetalle) {
        check('el XML incluye <Referencia> con el folio y la razón correctos',
            ncSinDetalle.dteXmlFirmado.includes('<FolioRef>1</FolioRef>') && ncSinDetalle.dteXmlFirmado.includes('Corrige giro del receptor'));
        check('el documento igual arma TED y Signature aunque no tenga detalle',
            ncSinDetalle.dteXmlFirmado.includes('<TED version="1.0">') && ncSinDetalle.dteXmlFirmado.includes('<Signature'));
    } else {
        check('<Referencia> / TED / Signature (omitidos por error previo)', false);
    }

    // 8.4 — Una Factura normal (sin referencias) sigue rechazando detalle vacío — no se relajó de más.
    check('una Factura sin referencias sigue rechazando detalle vacío', (() => {
        try {
            buildYFirmarDte({
                tipoDte: 33, folio: 3, fechaEmision: '2026-07-18',
                emisor: emisorTest, receptor: { nombre: 'x' }, detalle: [], caf: cafFactura, pemData,
            });
            return false;
        } catch { return true; }
    })());
}

// ── 9. Regresión — bugs reales del sobre EnvioDTE (FchResol, TpoDTE, XML anidado) ──
console.log('\n[9] Regresión — sobre EnvioDTE: FchResol obligatorio, TpoDTE, sin <?xml?> anidado (bugs reales 2026-07-19)');
{
    check('buildCaratula rechaza si falta fchResol (incluso con nroResol=0)', (() => {
        try {
            buildCaratula({ rutEmisor: '78184828-K', rutEnvia: '19169587-9', subtotales: [{ tipoDte: 39, cantidad: 1 }] });
            return false;
        } catch { return true; }
    })());

    const caratula = buildCaratula({
        rutEmisor: '78184828-K',
        rutEnvia: '19169587-9',
        fchResol: '2026-07-18',
        subtotales: [{ tipoDte: 39, cantidad: 1 }],
    });
    check('la Carátula incluye <FchResol> con el valor pasado', caratula.includes('<FchResol>2026-07-18</FchResol>'));
    check('<SubTotDTE> usa <TpoDTE>, no <TipoDTE>', caratula.includes('<TpoDTE>39</TpoDTE>') && !caratula.includes('<TipoDTE>39</TipoDTE>'));
    check('la Carátula usa <TmstFirmaEnv>, no <TmsFirmaEnv>', /<TmstFirmaEnv>/.test(caratula) && !/<TmsFirmaEnv>/.test(caratula));
    const ordenCorrecto = caratula.indexOf('<RutReceptor>') < caratula.indexOf('<FchResol>') && caratula.indexOf('<FchResol>') < caratula.indexOf('<NroResol>');
    check('orden de la Carátula: RutReceptor, FchResol, NroResol', ordenCorrecto);

    const pemData = generarPfxDePrueba();
    const cafSintetico = generarCafDePrueba({ tipoDte: 39 });

    // buildYFirmarDte (standalone) sigue funcionando igual que antes -- envuelve buildDte() en su
    // propio <DTE> y firma de inmediato, para uso aislado/pruebas (no para meter en un EnvioDTE).
    const { dteXmlFirmado } = buildYFirmarDte({
        tipoDte: 39, folio: 1, fechaEmision: '2026-07-18',
        emisor: { rut: cafSintetico.rutEmisor, razonSocial: 'NATIVECODE SPA' },
        receptor: { rut: '66666666-6', nombre: 'Cliente de Prueba' },
        detalle: [{ nombre: 'Cambio de aceite', cantidad: 1, precioUnitario: 19900 }],
        caf: cafSintetico, pemData,
    });
    check('cada DTE standalone sigue trayendo su propio <?xml?>', /^<\?xml/.test(dteXmlFirmado));

    // Flujo real usado por dteService.js: buildDte (sin firmar) + buildEnvioDteSinFirmar +
    // firmarEnvioDteEnSitio -- firma Documento y SetDTE ya ensamblados en su posición final,
    // con xsi:schemaLocation y el resto de <EnvioDTE> ya puestos.
    const { documentoId, documentoXml } = buildDte({
        tipoDte: 33, folio: 1, fechaEmision: '2026-07-18',
        emisor: { rut: '78184828-K', razonSocial: 'NATIVECODE SPA' },
        receptor: { rut: '11111111-1', nombre: 'Cliente de Prueba' },
        detalle: [{ nombre: 'Servicio', cantidad: 1, precioUnitario: 1000 }],
        caf: generarCafDePrueba({ tipoDte: 33 }),
    });
    const documentos = [{ documentoId, documentoXml, tipoDte: 33 }];
    const envioId = 'SetDocTest9';
    const { envioXmlSinFirmar } = buildEnvioDteSinFirmar({
        rutEmisor: '78184828-K', rutEnvia: '19169587-9', fchResol: '2026-07-18', documentos, envioId,
    });
    check('el sobre sin firmar incluye xsi:schemaLocation', envioXmlSinFirmar.includes('xsi:schemaLocation'));

    const envioFirmado = firmarEnvioDteEnSitio(envioXmlSinFirmar, documentos, envioId, pemData);
    const declaracionesXml = (envioFirmado.match(/<\?xml/g) || []).length;
    check('el sobre EnvioDTE tiene un único <?xml?>', declaracionesXml === 1, `se encontraron ${declaracionesXml}`);

    const signatureCount = (envioFirmado.match(/<Signature xmlns/g) || []).length;
    check('el sobre tiene 2 firmas (Documento y SetDTE)', signatureCount === 2, `se encontraron ${signatureCount}`);

    // Verificación criptográfica real de AMBAS firmas -- esto es lo que de verdad importa: no
    // solo que el XML se arme sin excepciones, sino que las firmas sean válidas incluso con
    // xsi:schemaLocation presente en <EnvioDTE> (bug real que costó 3 folios de Factura en
    // producción antes de encontrar la causa: firmar antes de ensamblar el sobre invalida la
    // firma en cuanto el ancestro agrega un namespace nuevo, 2026-07-19).
    const doc = new DOMParser().parseFromString(envioFirmado, 'text/xml');
    const signatureNodes = xpath.select("//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']", doc);
    let ambasValidas = signatureNodes.length === 2;
    if (ambasValidas) {
        for (const node of signatureNodes) {
            try {
                const verifier = new SignedXml({ publicCert: pemData.certPem });
                verifier.loadSignature(node);
                if (!verifier.checkSignature(envioFirmado)) ambasValidas = false;
            } catch {
                ambasValidas = false;
            }
        }
    }
    check('ambas firmas (Documento y SetDTE) son criptográficamente válidas con xsi:schemaLocation presente', ambasValidas);
}

// ── 10. Regresión — bug real: encoding ISO-8859-1 declarado vs bytes UTF-8 enviados
//         (2026-07-19). El prólogo del sobre declara ISO-8859-1, pero `new Blob([string])`
//         codifica cualquier string JS como UTF-8 sin importar el prólogo -- con tildes/ñ
//         (inevitables en datos reales chilenos: comunas, giros, nombres) el SII decodificaba
//         esos bytes como si fueran ISO-8859-1 y obtenía texto corrupto, lo que invalidaba la
//         firma en su lado aunque la firma fuera perfecta sobre el contenido real. Confirmado con
//         el emisor real de NATIVECODE SPA (`emisor_comuna = "ÑIQUÉN"`, tilde + ñ) y con el
//         detalle de prueba del SET BASICO ("Cajón").
console.log('\n[10] Regresión — bytes ISO-8859-1 reales al enviar (bug real: tildes/ñ corrompidas por Blob=UTF-8, 2026-07-19)');
{
    const textoConTildes = 'Cajón, Peñalolén, Diseño, ÑIQUÉN';
    const bytes = xmlComoBytesIso88591(textoConTildes);

    check(
        'los bytes producidos son ISO-8859-1 real (1 byte por carácter), no UTF-8',
        bytes.length === textoConTildes.length,
        `esperado ${textoConTildes.length} bytes, se obtuvieron ${bytes.length}`
    );
    check(
        'decodificar esos bytes como latin1 recupera el texto original exacto',
        bytes.toString('latin1') === textoConTildes
    );

    const bytesUtf8DeReferencia = Buffer.from(textoConTildes, 'utf8');
    check(
        'la codificación UTF-8 (el bug) habría producido más bytes que caracteres -- confirma que el bug era real',
        bytesUtf8DeReferencia.length > textoConTildes.length
    );

    let lanzaConCaracterFueraDeRango = false;
    try {
        xmlComoBytesIso88591('emoji fuera de rango: \u{1F600}');
    } catch {
        lanzaConCaracterFueraDeRango = true;
    }
    check('lanza error explícito si el XML tiene un carácter fuera del rango ISO-8859-1 (en vez de truncarlo en silencio)', lanzaConCaracterFueraDeRango);
}

console.log(`\n${failed === 0 ? '✅ Todas las verificaciones pasaron.' : `❌ ${failed} verificación(es) fallaron.`}\n`);
process.exit(failed === 0 ? 0 : 1);
