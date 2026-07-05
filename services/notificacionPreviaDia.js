import DataBase from '../config/Database.js';

/**
 * SISTEMA DE RECORDATORIOS AUTOMÁTICOS DE CITAS
 *
 * Envía correos de recordatorio:
 * - 12 horas antes de la cita
 * - 6 horas antes de la cita
 *
 * Debe ejecutarse como cron job cada 5-10 minutos
 */

const DIRECCION_CLINICA = "SILUETA CHIC, Avenida Irarrázaval 1989 OF 204 SUR, Ñuñoa, Santiago, Chile";
let recordatoriosDeshabilitadosPorEsquema = false;

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
 * Envía el correo de recordatorio usando Brevo API
 */
async function enviarCorreoRecordatorio({ email, nombrePaciente, apellidoPaciente, fecha, hora, tipoRecordatorio }) {
  const { BREVO_API_KEY, CORREO_RECEPTOR, NOMBRE_EMPRESA } = process.env;

  if (!BREVO_API_KEY) {
    console.warn("[RECORDATORIO] BREVO_API_KEY no configurada. Correo no enviado.");
    return false;
  }

  if (!email) {
    console.warn("[RECORDATORIO] Email vacío. Correo no enviado.");
    return false;
  }

  const fromEmail = CORREO_RECEPTOR;
  const fromName = NOMBRE_EMPRESA || "SiluetaChic";

  if (!fromEmail) {
    console.warn("[RECORDATORIO] CORREO_RECEPTOR no configurado. Correo no enviado.");
    return false;
  }

  const horasRestantes = tipoRecordatorio === '12h' ? '12 horas' : '6 horas';
  const subject = `Recordatorio de cita programada - ${horasRestantes} restantes`;

  const clinicaNombre = fromName;

  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f7;padding:48px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="max-width:580px;background:#ffffff;border-radius:18px;
              box-shadow:0 4px 24px rgba(0,0,0,.08),0 1px 4px rgba(0,0,0,.04);overflow:hidden;">

  <!-- Línea NativeCode -->
  <tr><td style="background:#6366f1;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Header oscuro -->
  <tr>
    <td style="background:linear-gradient(135deg,#1c1c1e 0%,#2c2c2e 100%);padding:36px 40px 32px;">
      <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#8e8e93;">${clinicaNombre}</p>
      <h1 style="margin:0 0 10px 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-.4px;line-height:1.25;">Recordatorio de Cita</h1>
      <p style="margin:0;font-size:14px;color:#aeaeb2;">Faltan <strong style="color:#a78bfa;">${horasRestantes}</strong> para su cita agendada.</p>
    </td>
  </tr>

  <!-- Cuerpo -->
  <tr>
    <td style="padding:36px 40px 32px;">

      <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:#1c1c1e;">
        Estimado/a ${nombrePaciente}${apellidoPaciente ? ' ' + apellidoPaciente : ''}:
      </p>
      <p style="margin:0 0 28px 0;font-size:14px;color:#3a3a3c;line-height:1.7;">
        Junto con saludarle, le informamos que tiene una cita programada con el siguiente detalle:
      </p>

      <!-- Detalle cita -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f5f5f7;border-radius:12px;overflow:hidden;margin:0 0 24px 0;">
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid #e5e5ea;">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#8e8e93;">Fecha</span><br>
            <span style="font-size:15px;font-weight:600;color:#1c1c1e;margin-top:4px;display:block;">${fecha}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid #e5e5ea;">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#8e8e93;">Hora</span><br>
            <span style="font-size:15px;font-weight:600;color:#1c1c1e;margin-top:4px;display:block;">${hora}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#8e8e93;">Lugar</span><br>
            <span style="font-size:14px;color:#1c1c1e;margin-top:4px;display:block;line-height:1.5;">${DIRECCION_CLINICA}</span>
          </td>
        </tr>
      </table>

      <!-- Aviso -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f5f5f7;border-radius:10px;margin:0 0 28px 0;">
        <tr>
          <td style="padding:16px 20px;border-left:3px solid #3a3a3c;">
            <p style="margin:0;font-size:13px;color:#3a3a3c;line-height:1.7;">
              <strong>Aviso importante:</strong> En caso de no poder asistir, le solicitamos informarnos con anticipación para poder reprogramar su hora y liberar el cupo para otro paciente.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 28px 0;font-size:14px;color:#3a3a3c;line-height:1.7;">
        Quedamos a su disposición para cualquier consulta o requerimiento.
      </p>

      <!-- Firma -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e5e5ea;padding-top:20px;width:100%;">
        <tr>
          <td>
            <p style="margin:0 0 2px 0;font-size:13px;color:#8e8e93;">Atentamente,</p>
            <p style="margin:0 0 1px 0;font-size:15px;font-weight:700;color:#1c1c1e;">${clinicaNombre}</p>
            <p style="margin:0;font-size:11px;color:#a78bfa;font-weight:600;letter-spacing:.04em;">Powered by NativeCode</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f5f5f7;padding:20px 40px;border-top:1px solid #e5e5ea;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td>
            <span style="font-size:12px;color:#8e8e93;font-weight:500;">
              © ${year} ${clinicaNombre}
            </span>
          </td>
          <td align="right">
            <span style="font-size:11px;color:#aeaeb2;">
              Mensaje automático · No responder
            </span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:6px;">
            <span style="font-size:11px;color:#aeaeb2;">
              Soporte técnico:
              <a href="mailto:ingenieria.software@nativecode.cl"
                 style="color:#8e8e93;text-decoration:none;">ingenieria.software@nativecode.cl</a>
              · +56 9 3291 2943
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;

  const text = `
Recordatorio de cita - ${clinicaNombre}

Hola, ${nombrePaciente}${apellidoPaciente ? ' ' + apellidoPaciente : ''}:

Le recordamos que tiene una cita agendada con el siguiente detalle:

Fecha: ${fecha}
Hora: ${hora}
Lugar: ${DIRECCION_CLINICA}

Si no puede asistir, le pedimos avisarnos con anticipación para reprogramar su cita y liberar el cupo para otro paciente.

Quedamos atentos/as ante cualquier consulta.

Con cariño,
${clinicaNombre}
  `;

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email }],
    subject,
    textContent: text,
    htmlContent: html
  };

  try {
    const resp = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    }, Number(process.env.EMAIL_TIMEOUT_MS || 15000));

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[RECORDATORIO] Brevo error:", resp.status, errText);
      return false;
    }

    console.log(`[RECORDATORIO] Correo de ${tipoRecordatorio} enviado a ${email}`);
    return true;
  } catch (error) {
    console.error("[RECORDATORIO] Error al enviar correo:", error.message);
    return false;
  }
}

/**
 * Marca el recordatorio como enviado en la base de datos
 */
async function marcarRecordatorioEnviado(id_reserva, tipoRecordatorio) {
  if (recordatoriosDeshabilitadosPorEsquema) return;
  try {
    const conexion = DataBase.getInstance();
    const campo = tipoRecordatorio === '12h' ? 'recordatorio12h' : 'recordatorio6h';
    const query = `UPDATE reservaPacientes SET ${campo} = 1 WHERE id_reserva = ?`;
    await conexion.ejecutarQuery(query, [id_reserva]);
    console.log(`[RECORDATORIO] Marcado ${tipoRecordatorio} para reserva ${id_reserva}`);
  } catch (error) {
    console.error(`[RECORDATORIO] Error al marcar recordatorio:`, error.message);
  }
}

/**
 * Obtiene las reservas que necesitan recordatorio
 * Busca citas entre 5.5 y 12.5 horas en el futuro
 */
async function obtenerReservasParaRecordatorio() {
  if (recordatoriosDeshabilitadosPorEsquema) return [];
  try {
    const conexion = DataBase.getInstance();

    // Obtener reservas activas que están entre 0 y 13 horas en el futuro
    const query = `
      SELECT 
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        email,
        fechaInicio,
        horaInicio,
        estadoReserva,
        COALESCE(recordatorio12h, 0) as recordatorio12h,
        COALESCE(recordatorio6h, 0) as recordatorio6h,
        TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(fechaInicio, horaInicio)) as minutos_restantes
      FROM reservaPacientes 
      WHERE estadoReserva IN ('reservada', 'CONFIRMADA')
        AND estadoPeticion <> 0
        AND TIMESTAMP(fechaInicio, horaInicio) > NOW()
        AND TIMESTAMP(fechaInicio, horaInicio) <= DATE_ADD(NOW(), INTERVAL 13 HOUR)
    `;

    const reservas = await conexion.ejecutarQuery(query);
    return Array.isArray(reservas) ? reservas : [];
  } catch (error) {
    const msg = String(error?.message || "");
    const noTable = error?.code === "ER_NO_SUCH_TABLE"
      || msg.includes("doesn't exist")
      || msg.toLowerCase().includes("doesn't exist");

    if (noTable) {
      recordatoriosDeshabilitadosPorEsquema = true;
      console.warn("[RECORDATORIO] Tabla de reservas no existe en este esquema. Recordatorios automáticos deshabilitados.");
      return [];
    }

    console.error("[RECORDATORIO] Error al obtener reservas:", error.message);
    return [];
  }
}

/**
 * Formatea la fecha para mostrar en el correo
 */
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return fecha.toLocaleDateString('es-CL', opciones);
}

/**
 * FUNCIÓN PRINCIPAL - Ejecutar como cron job cada 5-10 minutos
 *
 * Revisa todas las reservas próximas y envía recordatorios:
 * - 12 horas antes (entre 11.5 y 12.5 horas = 690-750 minutos)
 * - 6 horas antes (entre 5.5 y 6.5 horas = 330-390 minutos)
 */
export async function ejecutarRecordatoriosAutomaticos() {
  if (recordatoriosDeshabilitadosPorEsquema) return;

  console.log("[RECORDATORIO] ========================================");
  console.log("[RECORDATORIO] Iniciando proceso de recordatorios...");
  console.log("[RECORDATORIO] Fecha/Hora actual:", new Date().toLocaleString('es-CL'));

  try {
    const reservas = await obtenerReservasParaRecordatorio();

    if (reservas.length === 0) {
      console.log("[RECORDATORIO] No hay reservas próximas para recordar.");
      console.log("[RECORDATORIO] ========================================");
      return { enviados: 0, errores: 0 };
    }

    console.log(`[RECORDATORIO] Encontradas ${reservas.length} reserva(s) próxima(s)`);

    let enviados = 0;
    let errores = 0;

    for (const reserva of reservas) {
      const {
        id_reserva,
        nombrePaciente,
        apellidoPaciente,
        email,
        fechaInicio,
        horaInicio,
        recordatorio12h,
        recordatorio6h,
        minutos_restantes
      } = reserva;

      console.log(`[RECORDATORIO] Procesando reserva ${id_reserva}: ${nombrePaciente} - ${minutos_restantes} minutos restantes`);

      // Recordatorio de 12 horas (entre 690 y 750 minutos = 11.5h a 12.5h)
      if (minutos_restantes >= 690 && minutos_restantes <= 750 && !recordatorio12h) {
        console.log(`[RECORDATORIO] Enviando recordatorio de 12h a ${email}...`);

        const enviado = await enviarCorreoRecordatorio({
          email,
          nombrePaciente,
          apellidoPaciente,
          fecha: formatearFecha(fechaInicio),
          hora: horaInicio,
          tipoRecordatorio: '12h'
        });

        if (enviado) {
          await marcarRecordatorioEnviado(id_reserva, '12h');
          enviados++;
        } else {
          errores++;
        }
      }

      // Recordatorio de 6 horas (entre 330 y 390 minutos = 5.5h a 6.5h)
      if (minutos_restantes >= 330 && minutos_restantes <= 390 && !recordatorio6h) {
        console.log(`[RECORDATORIO] Enviando recordatorio de 6h a ${email}...`);

        const enviado = await enviarCorreoRecordatorio({
          email,
          nombrePaciente,
          apellidoPaciente,
          fecha: formatearFecha(fechaInicio),
          hora: horaInicio,
          tipoRecordatorio: '6h'
        });

        if (enviado) {
          await marcarRecordatorioEnviado(id_reserva, '6h');
          enviados++;
        } else {
          errores++;
        }
      }
    }

    console.log(`[RECORDATORIO] Proceso finalizado. Enviados: ${enviados}, Errores: ${errores}`);
    console.log("[RECORDATORIO] ========================================");

    return { enviados, errores };
  } catch (error) {
    console.error("[RECORDATORIO] Error en el proceso:", error.message);
    console.log("[RECORDATORIO] ========================================");
    return { enviados: 0, errores: 1 };
  }
}

/**
 * Función para enviar recordatorio manual (útil para testing)
 */
export async function enviarRecordatorioManual({ email, nombrePaciente, apellidoPaciente, fecha, hora }) {
  return await enviarCorreoRecordatorio({
    email,
    nombrePaciente,
    apellidoPaciente,
    fecha,
    hora,
    tipoRecordatorio: 'manual'
  });
}
