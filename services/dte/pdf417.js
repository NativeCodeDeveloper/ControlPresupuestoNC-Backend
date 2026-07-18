import bwipjs from 'bwip-js';

// Código de barras PDF417 del Timbre Electrónico, para la representación impresa del DTE.
// Reglas del SII (Instructivo Técnico, Anexo 2.5):
//   - Modo de codificación binario (Byte Compaction Mode) para evitar problemas con caracteres
//     especiales del XML del timbre.
//   - Error Correction Level (ECL) 5.
//   - X-Dim mínimo 6,7 mils; relación alto:ancho de fila 3:1.
//   - Sin truncado ("Truncated" no debe usarse).
//   - Quiet zone mínima de 0,25" en los cuatro lados.
//   - Tamaño impreso recomendado máximo: 3 cm alto x 9 cm ancho.
//
// La ubicación/escala física final dentro del PDF impreso (DPI, cm exactos) se ajusta en la capa
// que arma la representación impresa del DTE (fuera de este módulo) — acá se genera el buffer de
// imagen a la resolución que ese consumidor pida.

/**
 * Genera el código de barras PDF417 del timbre electrónico como PNG.
 * @param {string} tedXmlString - el <TED>...</TED> completo (con datos y firma), tal como se
 *   incluye en el DTE.
 * @param {Object} [options]
 * @param {number} [options.scale=3] - factor de escala del PNG generado.
 * @returns {Promise<Buffer>} PNG buffer del código de barras.
 */
export function generarTimbrePdf417(tedXmlString, { scale = 3 } = {}) {
    return bwipjs.toBuffer({
        bcid: 'pdf417',            // sin variante "compact" — el SII prohíbe el truncado
        text: tedXmlString,
        eclevel: 5,                // Error Correction Level exigido por el SII
        rowheight: 3,               // relación alto:ancho de fila 3:1
        includetext: false,
        paddingwidth: 18,           // ≈0.25" de quiet zone a la escala/DPI por defecto de bwip-js
        paddingheight: 18,
        scale,
    });
}
