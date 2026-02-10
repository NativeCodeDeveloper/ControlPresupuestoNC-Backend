# Explicación de `enviarCorreoConfirmacionEquipo`

La función `enviarCorreoConfirmacionEquipo` es un método estático asíncrono dentro del servicio de notificaciones, encargado de enviar correos electrónicos al equipo interno cuando un paciente confirma o cancela una cita. Recibe un objeto con los detalles de la cita y la acción realizada.

## ¿Cómo funciona?

1.  **Verificación de Variables de Entorno:**
    La función comienza extrayendo las variables de entorno `BREVO_API_KEY`, `CORREO_RECEPTOR` y `NOMBRE_EMPRESA`. Es crucial que `BREVO_API_KEY` esté configurada, ya que sin ella no se pueden enviar correos. Si falta, la función registra una advertencia y se detiene.

    ```javascript
    const { BREVO_API_KEY, CORREO_RECEPTOR, NOMBRE_EMPRESA } = process.env;

    if (!BREVO_API_KEY) {
      console.warn("[MAIL EQUIPO] BREVO_API_KEY no configurada. Correo no enviado.");
      return;
    }
    ```

2.  **Configuración del Remitente:**
    Define el correo (`fromEmail`) y el nombre (`fromName`) del remitente utilizando las variables de entorno `CORREO_RECEPTOR` y `NOMBRE_EMPRESA`. Si `NOMBRE_EMPRESA` no está definida, usa "SiluetaChic" por defecto. También verifica que `fromEmail` esté configurado.

    ```javascript
    const fromEmail = CORREO_RECEPTOR;
    const fromName = NOMBRE_EMPRESA || "SiluetaChic";

    if (!fromEmail) {
      console.warn("[MAIL EQUIPO] CORREO_RECEPTOR no configurado. Correo no enviado.");
      return;
    }
    ```

3.  **Destinatario Fijo:**
    El correo de destino para estas notificaciones internas está codificado como `desarrollo.native.code@gmail.com`.

    ```javascript
    const destinatario = "desarrollo.native.code@gmail.com";
    ```

4.  **Asunto del Correo (Subject):**
    Determina si la `accion` es "CONFIRMADA" o "CANCELADA" y construye dinámicamente el asunto del correo. Por ejemplo: `✅ Cita CONFIRMADA por [Nombre del Paciente]` o `❌ Cita CANCELADA por [Nombre del Paciente]`.

    ```javascript
    const esConfirmacion = accion === "CONFIRMADA";
    const subject = esConfirmacion
      ? `✅ Cita CONFIRMADA por ${nombrePaciente} ${apellidoPaciente}`
      : `❌ Cita CANCELADA por ${nombrePaciente} ${apellidoPaciente}`;
    ```

5.  **Contenido del Correo en Texto Plano (textContent):**
    Crea una versión de texto plano del cuerpo del correo. Este texto incluye los detalles del paciente, ID de reserva, fecha, hora y la acción realizada, adaptándose si la cita fue confirmada o cancelada.

    ```javascript
    const text = esConfirmacion
      ? `El paciente ${nombrePaciente} ${apellidoPaciente} ha CONFIRMADO su cita.

` +
        `• ID Reserva: ${id_reserva}
` +
        `• Fecha: ${fechaInicio}
` +
        `• Hora: ${horaInicio}

` +
        `El paciente confirmó desde el enlace del correo.`
      : `El paciente ${nombrePaciente} ${apellidoPaciente} ha CANCELADO su cita.

` +
        `• ID Reserva: ${id_reserva}
` +
        `• Fecha: ${fechaInicio}
` +
        `• Hora: ${horaInicio}

` +
        `El paciente canceló desde el enlace del correo.`;
    ```

6.  **Contenido del Correo en HTML (htmlContent):**
    Prepara variables para el estilo visual (`colorAccion`, `iconoAccion`, `textoAccion`) según la acción de la cita. Luego, construye un correo HTML estilizado utilizando un template literal. Este HTML contiene un encabezado con el estado de la cita, los detalles del paciente y la reserva, y un pie de página indicando que es un correo automático.

    ```javascript
    const colorAccion = esConfirmacion ? "#10b981" : "#ef4444"; // Verde para confirmada, rojo para cancelada
    const iconoAccion = esConfirmacion ? "✅" : "❌";
    const textoAccion = esConfirmacion ? "CONFIRMADA" : "CANCELADA";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <div style="background: ${colorAccion}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">${iconoAccion} Cita ${textoAccion}</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p><b>Paciente:</b> ${nombrePaciente} ${apellidoPaciente}</p>
          <p><b>ID Reserva:</b> ${id_reserva}</p>
          <p><b>Fecha:</b> ${fechaInicio}</p>
          <p><b>Hora:</b> ${horaInicio}</p>
          <p><b>Acción:</b> El paciente ${textoAccion.toLowerCase()} su cita desde el enlace del correo.</p>
          <hr style="border: none; border-top: 1px solid #d1d5db; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280;">
            Este es un correo automático del sistema de agendamiento de Silueta Chic.
          </p>
        </div>
      </div>
    `;
    ```

7.  **Carga Útil del Correo (Payload):**
    Se ensambla el objeto `payload` que se enviará a la API de Brevo. Contiene la información del remitente, el destinatario, el asunto, el contenido en texto plano y el contenido HTML.

    ```javascript
    const payload = {
      sender: { name: fromName, email: fromEmail },
      to: [{ email: destinatario }],
      subject,
      textContent: text,
      htmlContent: html
    };
    ```

8.  **Llamada a la API de Brevo:**
    Antes de realizar la llamada, verifica si la función `fetch` está disponible (requiere Node.js 18+). Luego, realiza una solicitud `POST` a la API de Brevo (`https://api.brevo.com/v3/smtp/email`) con el `payload` construido y las cabeceras necesarias, incluyendo la `api-key`. La función maneja posibles errores de la API registrándolos en la consola.

    ```javascript
    if (typeof fetch !== "function") {
      console.warn("[MAIL EQUIPO] Tu Node no tiene fetch (requiere Node 18+). Correo no enviado.");
      return;
    }

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
      console.error("[MAIL] Brevo error:", resp.status, errText);
      return;
    }
    ```
Esta función encapsula toda la lógica para construir y enviar notificaciones por correo electrónico al equipo, proporcionando información clara sobre el estado de las citas de los pacientes.