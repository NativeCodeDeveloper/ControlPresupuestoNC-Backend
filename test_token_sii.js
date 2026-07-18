// Script desechable de un solo uso -- prueba semilla+token contra el SII (sin folio, sin CAF,
// sin gastar nada). Se elimina del repo apenas confirmemos que la autenticación funciona.
import 'dotenv/config';
import fs from 'fs';
import { pfxToPem } from './services/dte/signXml.js';
import { obtenerToken } from './services/dte/siiClient.js';

const certPath = process.env.DTE_CERT_PATH;
const certPass = process.env.DTE_CERT_PASS;
const ambiente = process.env.DTE_AMBIENTE === 'produccion' ? 'produccion' : 'certificacion';

if (!certPath || !certPass) {
    console.error('Faltan DTE_CERT_PATH / DTE_CERT_PASS en el .env');
    process.exit(1);
}

console.log(`Ambiente: ${ambiente}`);
console.log(`Certificado: ${certPath}`);

const host = ambiente === 'produccion' ? 'palena.sii.cl' : 'maullin.sii.cl';
const url = `https://${host}/DTEWS/CrSeed.jws`;
console.log(`\nDEBUG: llamando directo a ${url} para ver la respuesta cruda...`);
try {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '' },
        body: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Body><getSeed xmlns="http://DefaultNamespace"/></soapenv:Body></soapenv:Envelope>`,
    });
    console.log('DEBUG: HTTP status =', res.status);
    const text = await res.text();
    console.log('DEBUG: raw body (primeros 1500 chars):\n', text.slice(0, 1500));
} catch (netError) {
    console.error('DEBUG: fetch directo fallo (probable problema de red/DNS/TLS):', netError.message);
}

try {
    const pemData = pfxToPem(fs.readFileSync(certPath), certPass);
    console.log('\nOK certificado leido. Titular:', pemData.certificate.subject.getField('CN')?.value || '(sin CN)');

    console.log('Pidiendo semilla + token al SII (via siiClient)...');
    const token = await obtenerToken(pemData, ambiente);
    console.log('OK token obtenido:', token.slice(0, 20) + '...');
    console.log('Autenticacion con el certificado contra el SII: OK.');
} catch (error) {
    console.error('FALLO:', error.message);
    process.exit(1);
}
