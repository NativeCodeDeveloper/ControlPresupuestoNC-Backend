// Script desechable de un solo uso -- prueba enviarSetDte() contra el SII real, SIN gastar
// folios reales (usa un CAF sintetico, no autorizado por el SII). El objetivo NO es que el SII
// acepte el documento -- lo va a rechazar porque el TED no fue firmado con un CAF real emitido
// para este RUT -- el objetivo es confirmar que:
//   1) nuestra solicitud (multipart, headers, firma XMLDSig del sobre con el certificado real)
//      llega bien formada al SII (no un error de transporte/formato antes de siquiera evaluar
//      el documento), y
//   2) sabemos parsear correctamente la respuesta (STATUS/TRACKID), igual que tuvimos que
//      arreglar para getSemilla() con el prefijo ns1:.
// Se elimina del repo apenas confirmemos el comportamiento.
import 'dotenv/config';
import fs from 'fs';
import crypto from 'crypto';
import { pfxToPem } from './services/dte/signXml.js';
import { obtenerToken, enviarSetDte } from './services/dte/siiClient.js';
import { buildYFirmarDte } from './services/dte/dteXml.js';
import { buildCaratula, buildYFirmarEnvioDte } from './services/dte/envioDte.js';

const certPath = process.env.DTE_CERT_PATH;
const certPass = process.env.DTE_CERT_PASS;
const rutEmisor = process.env.DTE_RUT_EMISOR;
const ambiente = process.env.DTE_AMBIENTE === 'produccion' ? 'produccion' : 'certificacion';

if (!certPath || !certPass || !rutEmisor) {
    console.error('Faltan DTE_CERT_PATH / DTE_CERT_PASS / DTE_RUT_EMISOR en el .env');
    process.exit(1);
}

function generarCafSintetico(tipoDte) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    const cafXmlOriginal =
        `<CAF version="1.0"><DA><RE>${rutEmisor}</RE><RS>NATIVECODE SPA</RS><TD>${tipoDte}</TD>` +
        `<RNG><D>1</D><H>5</H></RNG><FA>2026-07-18</FA>` +
        `<RSAPK><M>TEST</M><E>TEST</E></RSAPK><IDK>100</IDK></DA>` +
        `<FRMA algoritmo="SHA1withRSA">TESTFIRMASII</FRMA></CAF>`;
    return { rutEmisor, tipoDte, folioDesde: 1, folioHasta: 5, cafXmlOriginal, rsaPrivateKeyPem: privateKey, rsaPublicKeyPem: publicKey };
}

console.log(`Ambiente: ${ambiente}`);

try {
    const pemData = pfxToPem(fs.readFileSync(certPath), certPass);
    console.log('OK certificado leido.');

    const token = await obtenerToken(pemData, ambiente);
    console.log('OK token obtenido:', token.slice(0, 20) + '...');

    const caf = generarCafSintetico(39);
    const { documentoId, dteXmlFirmado } = buildYFirmarDte({
        tipoDte: 39,
        folio: 1,
        fechaEmision: new Date().toISOString().slice(0, 10),
        emisor: { rut: rutEmisor, razonSocial: 'NATIVECODE SPA', giro: 'Servicios informaticos', direccion: 'Test 123', comuna: 'Santiago' },
        receptor: { nombre: 'Cliente de prueba transporte SII' },
        detalle: [{ nombre: 'Prueba de transporte SII', cantidad: 1, precioUnitario: 1000 }],
        caf,
        pemData,
    });
    console.log('OK DTE de prueba armado y firmado:', documentoId);

    const [rutSinDv, dv] = rutEmisor.split('-');
    const caratula = buildCaratula({ rutEmisor, rutEnvia: rutEmisor, subtotales: [{ tipoDte: 39, cantidad: 1 }] });
    const envioFirmado = buildYFirmarEnvioDte(caratula, [dteXmlFirmado], pemData, `SetDoc${documentoId}`);
    console.log('OK sobre EnvioDTE armado y firmado.');

    console.log('\nEnviando al SII (se espera rechazo -- CAF sintetico, no autorizado -- solo probamos transporte y parseo)...');
    const resultado = await enviarSetDte({
        envioXmlFirmado: envioFirmado,
        rutEnvia: rutSinDv, dvEnvia: dv,
        rutCompania: rutSinDv, dvCompania: dv,
        token, ambiente,
    });
    console.log('\nSTATUS:', resultado.status);
    console.log('TRACKID:', resultado.trackId);
    console.log('RAW (primeros 2000 chars):\n', resultado.raw.slice(0, 2000));
} catch (error) {
    console.error('FALLO:', error.message);
    process.exit(1);
}
