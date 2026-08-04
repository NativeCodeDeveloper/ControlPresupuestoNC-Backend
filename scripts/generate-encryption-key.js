#!/usr/bin/env node

/**
 * generate-encryption-key.js
 *
 * Genera una clave maestra para cifrado de API keys.
 *
 * USO:
 *   node scripts/generate-encryption-key.js
 *
 * IMPORTANTE:
 *   - La clave generada debe agregarse al .env como ENCRYPTION_KEY
 *   - NUNCA hacer commit de ENCRYPTION_KEY al repositorio
 *   - NUNCA compartir esta clave con nadie
 *   - Si se pierde, no se pueden recuperar las API keys cifradas
 */

import crypto from 'crypto';

function generateMasterKey() {
  // 256 bits = 32 bytes = 64 caracteres hexadecimales
  return crypto.randomBytes(32).toString('hex');
}

console.log('\n🔐 Clave maestra generada:\n');
console.log('ENCRYPTION_KEY=' + generateMasterKey());
console.log('\n⚠️  INSTRUCCIONES:\n');
console.log('1. Copia esta línea al archivo control-back/.env');
console.log('2. NUNCA hacer commit de esta clave al repositorio');
console.log('3. Guarda esta clave en un lugar seguro (si se pierde, no se pueden recuperar las API keys)');
console.log('4. En producción, esta clave debe estar en las variables de entorno del servidor\n');
