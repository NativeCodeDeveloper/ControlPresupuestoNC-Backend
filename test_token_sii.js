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

try {
    const pemData = pfxToPem(fs.readFileSync(certPath), certPass);
    console.log('OK certificado leido. Titular:', pemData.certificate.subject.getField('CN')?.value || '(sin CN)');

    console.log('Pidiendo semilla + token al SII...');
    const token = await obtenerToken(pemData, ambiente);
    console.log('OK token obtenido:', token.slice(0, 20) + '...');
    console.log('Autenticacion con el certificado contra el SII: OK.');
} catch (error) {
    console.error('FALLO:', error.message);
    process.exit(1);
}
