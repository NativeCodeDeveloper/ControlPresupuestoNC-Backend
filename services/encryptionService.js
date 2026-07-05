import crypto from 'crypto';

const ALG    = 'aes-256-cbc';
const IV_LEN = 16;

function getKey() {
    const hex = process.env.BOVEDA_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) throw new Error('BOVEDA_ENCRYPTION_KEY inválida o ausente');
    return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return null;
    const key    = getKey();
    const iv     = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALG, key, iv);
    const enc    = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + enc.toString('hex');
}

export function decrypt(ciphertext) {
    if (!ciphertext || !String(ciphertext).includes(':')) return null;
    try {
        const [ivHex, encHex] = String(ciphertext).split(':');
        const key     = getKey();
        const iv      = Buffer.from(ivHex, 'hex');
        const enc     = Buffer.from(encHex, 'hex');
        const decipher = crypto.createDecipheriv(ALG, key, iv);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch { return null; }
}
