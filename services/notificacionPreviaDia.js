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

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Recordatorio de Cita</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Faltan ${horasRestantes} para tu cita</p>
      </div>

      <!-- Body -->
      <div style="padding: 30px 25px; background: #ffffff;">
        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
          Estimado/a <b>${nombrePaciente} ${apellidoPaciente || ''}</b>:
        </p>
        
        <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
          Junto con saludarle, queremos recordarle que mantiene una cita agendada según el siguiente detalle:
        </p>

        <!-- Detalle de la cita -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 0 0 25px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-size: 20px;">📅</span>
                <span style="color: #6b7280; margin-left: 10px;">Fecha:</span>
              </td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                <b style="color: #111827;">${fecha}</b>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-size: 20px;">⏰</span>
                <span style="color: #6b7280; margin-left: 10px;">Hora:</span>
              </td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                <b style="color: #111827;">${hora}</b>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="font-size: 20px;">📍</span>
                <span style="color: #6b7280; margin-left: 10px;">Lugar:</span>
              </td>
              <td style="padding: 10px 0; text-align: right;">
                <b style="color: #111827; font-size: 13px;">${DIRECCION_CLINICA}</b>
              </td>
            </tr>
          </table>
        </div>

        <!-- Mensaje importante -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
            <b>⚠️ Importante:</b> Le solicitamos, por favor, no olvidar asistir a su cita en el horario indicado. 
            En caso de no poder concurrir, le agradeceremos avisar con anticipación para poder reprogramarla 
            y así liberar el cupo para otro paciente.
          </p>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">
          Quedamos atentos/as ante cualquier consulta o confirmación.
        </p>

        <!-- Firma -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
          <p style="margin: 0; color: #374151;">
            Atentamente,<br>
            <b style="color: #667eea;">Silueta Chic</b>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f3f4f6; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
          Este es un correo automático del sistema de agendamiento.<br>
          Por favor no responda a este mensaje.
        </p>
      </div>
    </div>
  `;

  const text = `
Recordatorio de cita - Silueta Chic

Estimado/a ${nombrePaciente} ${apellidoPaciente || ''}:

Junto con saludarle, queremos recordarle que mantiene una cita agendada según el siguiente detalle:

📅 Fecha: ${fecha}
⏰ Hora: ${hora}
📍 Lugar: ${DIRECCION_CLINICA}

Le solicitamos, por favor, no olvidar asistir a su cita en el horario indicado. En caso de no poder concurrir, le agradeceremos avisar con anticipación para poder reprogramarla y así liberar el cupo para otro paciente.

Quedamos atentos/as ante cualquier consulta o confirmación.

Atentamente,
Silueta Chic
  `;

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email }],
    subject,
    textContent: text,
    htmlContent: html
  };

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

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
