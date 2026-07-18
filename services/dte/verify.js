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
 */
import crypto from 'crypto';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { canonicalizeSiiTed, buildTedDatos, signTed, verifyTed } from './ted.js';
import { pfxToPem, signDocumento } from './signXml.js';
import { buildYFirmarDte, computeMontosBoleta } from './dteXml.js';
import { generarTimbrePdf417 } from './pdf417.js';

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

    const xml = '<DTE version="1.0"><Documento ID="TESTDOC1"><Encabezado><IdDoc><TipoDTE>39</TipoDTE></IdDoc></Encabezado></Documento></DTE>';
    const signedXml = signDocumento(xml, pemData, 'TESTDOC1');
    check('signDocumento() inserta un elemento <Signature>', signedXml.includes('<Signature'));

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

console.log(`\n${failed === 0 ? '✅ Todas las verificaciones pasaron.' : `❌ ${failed} verificación(es) fallaron.`}\n`);
process.exit(failed === 0 ? 0 : 1);
