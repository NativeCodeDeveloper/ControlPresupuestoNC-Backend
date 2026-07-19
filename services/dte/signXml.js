import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

// Firma XMLDSig estándar del DTE completo y del sobre EnvioDTE, con el certificado digital
// (.pfx) del representante legal. Distinta de la firma del Timbre Electrónico (ver ted.js, que
// usa la llave del CAF y una canonicalización propia del SII, no XMLDSig).
// Referencia: SII "Instructivo Técnico Factura Electrónica" (28/10/2021), Anexo 3.3.1.

const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Extrae la llave privada y el certificado de un archivo .pfx (PKCS#12), en memoria.
 * @param {Buffer} pfxBuffer
 * @param {string} password
 * @returns {{ privateKeyPem: string, certPem: string, certificate: forge.pki.Certificate }}
 */
export function pfxToPem(pfxBuffer, password) {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!keyBag) throw new Error('No se encontró llave privada en el certificado .pfx');

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    if (!certBag) throw new Error('No se encontró certificado en el archivo .pfx');

    return {
        privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
        certPem: forge.pki.certificateToPem(certBag.cert),
        certificate: certBag.cert,
    };
}

/**
 * Extrae el RUT del titular de un certificado digital chileno desde su `subject.serialNumber`
 * (OID 2.5.4.5), donde los certificados de FirmaElectronica.cl/Acepta/etc. codifican el RUN.
 * Necesario porque `<RutEnvia>` en la Carátula del sobre EnvioDTE debe ser el RUT de quien firma
 * (el titular del certificado), no necesariamente el de la empresa emisora (`<RutEmisor>`) —
 * pueden ser personas distintas (ej. un representante autorizado firmando por la empresa).
 * @param {forge.pki.Certificate} certificate
 * @returns {string} RUT normalizado (`NNNNNNNN-D`)
 */
export function extraerRutCertificado(certificate) {
    const attr = certificate.subject.attributes.find((a) => a.name === 'serialNumber' || a.type === '2.5.4.5');
    if (!attr?.value) throw new Error('No se pudo extraer el RUT del titular desde el certificado (subject.serialNumber)');
    return String(attr.value).trim();
}

// Convierte un forge.jsbn.BigInteger a base64 (arreglo de bytes big-endian, entero sin signo) —
// misma convención que usa el SII para <Modulus>/<Exponent> (ver ted.js parseCaf, campo RSAPK).
function bigIntToBase64(bigInt) {
    let hex = bigInt.toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    return Buffer.from(hex, 'hex').toString('base64');
}

// Envuelve un string base64 a `lineLength` caracteres por línea (RFC 2045 §6.8, exigido por el
// SII en Anexo 2.4/3.3.1 para todo valor Base64 embebido en el XML).
export function wrapBase64(base64String, lineLength = 76) {
    const lines = [];
    for (let i = 0; i < base64String.length; i += lineLength) {
        lines.push(base64String.slice(i, i + lineLength));
    }
    return lines.join('\n');
}

/**
 * Firma un elemento XML (DTE completo o sobre EnvioDTE) con XMLDSig estándar, usando el
 * certificado del emisor. Produce KeyInfo con RSAKeyValue (Modulus/Exponent) y X509Certificate,
 * ambos exigidos por el SII (Anexo 3.3.1/3.3.2).
 *
 * @param {string} xmlString - el XML a firmar (debe contener un elemento con id `referenceId`).
 * @param {{ privateKeyPem: string, certPem: string, certificate: forge.pki.Certificate }} pemData
 * @param {string} referenceId - el valor del atributo ID del elemento a firmar (sin '#').
 * @returns {string} el XML original con la firma <Signature> insertada.
 */
export function signDocumento(xmlString, pemData, referenceId) {
    const { privateKeyPem, certPem, certificate } = pemData;
    const publicKey = certificate.publicKey;

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certPem,
        signatureAlgorithm: RSA_SHA1,
        canonicalizationAlgorithm: C14N,
        getKeyInfoContent: () => {
            const modulus = wrapBase64(bigIntToBase64(publicKey.n));
            const exponent = bigIntToBase64(publicKey.e);
            const x509 = wrapBase64(forge.util.encode64(
                forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
            ));
            return (
                `<KeyValue><RSAKeyValue><Modulus>${modulus}</Modulus>` +
                `<Exponent>${exponent}</Exponent></RSAKeyValue></KeyValue>` +
                `<X509Data><X509Certificate>${x509}</X509Certificate></X509Data>`
            );
        },
    });

    // Solo el transform enveloped-signature -- confirmado contra el validador de schema real del
    // SII (2026-07-19): con [ENVELOPED, C14N] rechazaba "Invalid content was found starting with
    // element 'Transform'. No child element is expected at this point" (Transforms del SII solo
    // admite un elemento). No tocar signWholeDocument (semilla) -- esa firma ya está confirmada
    // funcionando contra el SII real con ambos transforms, es un endpoint/schema distinto.
    sig.addReference({
        xpath: `//*[@ID='${referenceId}']`,
        transforms: [ENVELOPED],
        digestAlgorithm: SHA1,
    });

    sig.computeSignature(xmlString);
    return sig.getSignedXml();
}

/**
 * Firma un XML completo (sin atributo ID), referenciando el documento entero (URI vacía).
 * Usado para firmar la semilla al autenticarse contra el SII (getToken), donde el XML a firmar
 * es <getToken><item><Semilla>...</Semilla></item></getToken> sin ID — Manual Desarrollador
 * Autenticación Automática (OI2003_AUTAUTOM_MDE).
 *
 * @param {string} xmlString
 * @param {{ privateKeyPem: string, certPem: string, certificate: forge.pki.Certificate }} pemData
 * @returns {string}
 */
export function signWholeDocument(xmlString, pemData) {
    const { privateKeyPem, certPem, certificate } = pemData;
    const publicKey = certificate.publicKey;

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certPem,
        signatureAlgorithm: RSA_SHA1,
        canonicalizationAlgorithm: C14N,
        getKeyInfoContent: () => {
            const modulus = wrapBase64(bigIntToBase64(publicKey.n));
            const exponent = bigIntToBase64(publicKey.e);
            const x509 = wrapBase64(forge.util.encode64(
                forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
            ));
            return (
                `<KeyValue><RSAKeyValue><Modulus>${modulus}</Modulus>` +
                `<Exponent>${exponent}</Exponent></RSAKeyValue></KeyValue>` +
                `<X509Data><X509Certificate>${x509}</X509Certificate></X509Data>`
            );
        },
    });

    sig.addReference({
        xpath: '/*',
        transforms: [ENVELOPED, C14N],
        digestAlgorithm: SHA1,
        uri: '',
        isEmptyUri: true,
    });

    sig.computeSignature(xmlString);
    return sig.getSignedXml();
}
