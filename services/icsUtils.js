function pad(n) {
    return String(n).padStart(2, '0');
}

// Evita interpretar 'YYYY-MM-DD' como UTC (que en zonas horarias negativas corre
// la fecha un día hacia atrás al leerla con getters locales). Trabaja siempre
// con componentes de calendario, nunca cruzando por epoch/UTC.
function toDateParts(fecha) {
    if (typeof fecha === 'string') {
        const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
        }
    }
    const d = new Date(fecha);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function addDays({ year, month, day }, n) {
    const d = new Date(year, month - 1, day + n);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function formatDateParts({ year, month, day }) {
    return `${year}${pad(month)}${pad(day)}`;
}

function formatICSDateTime(fecha) {
    const d = new Date(fecha);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeICSText(texto = '') {
    return String(texto)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

// RFC 5545: las líneas se pliegan a 75 octetos; la continuación empieza con un espacio.
function foldLine(line) {
    if (line.length <= 75) return line;
    const partes = [];
    let resto = line;
    while (resto.length > 75) {
        partes.push(resto.slice(0, 75));
        resto = ' ' + resto.slice(75);
    }
    partes.push(resto);
    return partes.join('\r\n');
}

/**
 * Genera un archivo .ics (iCalendar) como texto plano, listo para adjuntar en un correo.
 *
 * @param {object} opts
 * @param {string} opts.uid            Identificador único del evento (ideal: estable por ciclo, ej. `pago-${id}-${fecha}@nativecode.cl`)
 * @param {string} opts.titulo         SUMMARY del evento
 * @param {string} [opts.descripcion]  DESCRIPTION del evento
 * @param {string} [opts.ubicacion]    LOCATION del evento
 * @param {Date|string} opts.fechaInicio
 * @param {Date|string} [opts.fechaFin]      Si no se indica: mismo día (todoElDia) o +1h (evento con hora)
 * @param {boolean} [opts.todoElDia=false]   true para eventos sin hora específica (ej. vencimiento de pago)
 * @param {string} [opts.nombreCalendario='NativeCode']
 * @returns {string} contenido .ics
 */
export function generarICS({
    uid,
    titulo,
    descripcion,
    ubicacion,
    fechaInicio,
    fechaFin,
    todoElDia = false,
    nombreCalendario = 'NativeCode',
}) {
    const dtStamp = formatICSDateTime(new Date()) + 'Z';

    let dtStartLine, dtEndLine;
    if (todoElDia) {
        const inicio = toDateParts(fechaInicio);
        const fin = fechaFin ? toDateParts(fechaFin) : addDays(inicio, 1);
        dtStartLine = `DTSTART;VALUE=DATE:${formatDateParts(inicio)}`;
        dtEndLine = `DTEND;VALUE=DATE:${formatDateParts(fin)}`;
    } else {
        dtStartLine = `DTSTART:${formatICSDateTime(fechaInicio)}`;
        dtEndLine = `DTEND:${formatICSDateTime(fechaFin || fechaInicio)}`;
    }

    const lineas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NativeCode//ES',
        `NAME:${nombreCalendario}`,
        `X-WR-CALNAME:${nombreCalendario}`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        dtStartLine,
        dtEndLine,
        `SUMMARY:${escapeICSText(titulo)}`,
        ...(descripcion ? [`DESCRIPTION:${escapeICSText(descripcion)}`] : []),
        ...(ubicacion ? [`LOCATION:${escapeICSText(ubicacion)}`] : []),
        'END:VEVENT',
        'END:VCALENDAR',
    ];

    return lineas.map(foldLine).join('\r\n');
}

export function generarICSBase64(opts) {
    return Buffer.from(generarICS(opts), 'utf-8').toString('base64');
}
