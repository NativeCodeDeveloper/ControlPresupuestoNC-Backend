/**
 * encryption.js
 *
 * Utilidades para cifrado de datos sensibles (API keys).
 *
 * Usa AES-256-GCM con:
 * - Derivación de clave PBKDF2 (100,000 iteraciones)
 * - Salt único por cifrado
 * - Authentication tag (GCM) para detectar manipulaciones
 *
 * La clave maestra viene de variable de entorno (NUNCA committing al repo).
 *
 * USO:
 * - Cifrar API keys de Agenda Clínica antes de guardarlas en BD
 * - Desencriptar solo en memoria al hacer llamadas HTTP
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const ITERATIONS = 100000;

/**
 * Obtiene la clave maestra desde variable de entorno.
 * En producción, esto debe estar en .env y NUNCA committing al repo.
 */
function getMasterKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    // En desarrollo, generar una clave temporal
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  ENCRYPTION_KEY no seteada - usando clave temporal (NO usar en producción)');
      return crypto.pbkdf2Sync('dev-key', 'salt', ITERATIONS, KEY_LENGTH, 'sha256');
    }
    throw new Error('ENCRYPTION_KEY no está configurada en producción');
  }

  // La clave debe ser hex de 64 caracteres (32 bytes = 256 bits)
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('ENCRYPTION_KEY debe ser hexadecimal de 64 caracteres');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Cifra un dato sensible (API key).
 *
 * @param {string} plaintext - Texto plano a cifrar
 * @returns {string} Texto cifrado en formato salt:iv:encrypted:authTag (hex)
 */
export function encryptApiKey(plaintext) {
  if (!plaintext) {
    return null;
  }

  try {
    const masterKey = getMasterKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Formato: salt:iv:encrypted:authTag (todo hex)
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      encrypted,
      authTag.toString('hex')
    ].join(':');
  } catch (error) {
    console.error('[encryptApiKey] Error:', error.message);
    throw new Error('Error al cifrar API key');
  }
}

/**
 * Desencripta un dato cifrado.
 *
 * @param {string} encrypted - Texto cifrado (formato salt:iv:encrypted:authTag)
 * @returns {string} Texto plano
 */
export function decryptApiKey(encrypted) {
  if (!encrypted) {
    return null;
  }

  try {
    const masterKey = getMasterKey();

    const parts = encrypted.split(':');
    if (parts.length !== 4) {
      throw new Error('Formato de cifrado inválido');
    }

    const [saltHex, ivHex, encryptedData, authTagHex] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[decryptApiKey] Error:', error.message);
    // Si falla el desencriptado, probable manipulación o clave incorrecta
    throw new Error('Error al desencriptar API key');
  }
}

/**
 * Valida si un texto parece ser un API key (básico).
 * Útil para validar antes de cifrar.
 *
 * @param {string} apiKey
 * @returns {boolean}
 */
export function isValidApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Longitud mínima razonable para API keys
  if (apiKey.length < 16) {
    return false;
  }

  // No permitir caracteres sospechosos
  if (/[\r\n\t<>]/.test(apiKey)) {
    return false;
  }

  return true;
}

/**
 * Genera una clave maestra aleatoria para desarrollo/testing.
 * NUNCA usar esta función en producción.
 *
 * @returns {string} Clave hexadecimal de 64 caracteres
 */
export function generateMasterKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

export default {
  encryptApiKey,
  decryptApiKey,
  isValidApiKey,
  generateMasterKey,
};
