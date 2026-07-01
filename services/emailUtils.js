export function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monto || 0);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Envía un correo vía Brevo API.
 * @param {object} opts
 * @param {string} opts.senderName  Nombre visible del remitente
 * @param {string} opts.senderEmail Email verificado en Brevo
 * @param {string} opts.to          Email del destinatario
 * @param {string} opts.subject
 * @param {string} opts.htmlContent
 * @param {string} opts.textContent
 * @param {string} [opts.logPrefix]  Prefijo para los console.log/error
 * @returns {Promise<boolean>}
 */
export async function sendBrevoEmail({ senderName, senderEmail, to, subject, htmlContent, textContent, logPrefix = '[EMAIL]' }) {
    const apiKey = process.env.BREVO_API_KEY;
    const timeoutMs = Number(process.env.EMAIL_TIMEOUT_MS || 15000);

    if (!apiKey) {
        console.warn(`${logPrefix} BREVO_API_KEY no configurada. Correo no enviado.`);
        return false;
    }

    const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent
    };

    try {
        const resp = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify(payload)
        }, timeoutMs);

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            console.error(`${logPrefix} Brevo error ${resp.status}:`, errText);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`${logPrefix} Error enviando correo:`, error.message);
        return false;
    }
}
