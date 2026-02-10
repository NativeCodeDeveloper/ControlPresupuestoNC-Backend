# Cambios Realizados para el Uso de Variables de Entorno

Se han realizado modificaciones en el archivo `services/notificacionAgendamiento.js` para asegurar que el nombre de la empresa (`NOMBRE_EMPRESA` del archivo `.env`) se utilice de forma consistente en el contenido de los correos electrónicos, en lugar de estar codificado directamente.

## `enviarCorreoConfirmacionReserva`

### Antes

La función `enviarCorreoConfirmacionReserva` tenía el nombre "Silueta Chic" codificado en el asunto del correo y en el encabezado HTML.

**Asunto:**
```javascript
const subject = "¡Tu cita con Silueta Chic ha sido confirmada! 🎉";
```

**Encabezado HTML:**
```html
<h2 style="color: #667eea;">¡Tu cita con Silueta Chic ha sido confirmada! 🎉</h2>
```

### Después

Se modificó para usar la variable `fromName`, que ya obtiene su valor de `NOMBRE_EMPRESA` del `.env` (o usa "SiluetaChic" por defecto si no está definida).

**Asunto:**
```javascript
const subject = `¡Tu cita con ${fromName} ha sido confirmada! 🎉`;
```

**Encabezado HTML:**
```html
<h2 style="color: #667eea;">¡Tu cita con ${fromName} ha sido confirmada! 🎉</h2>
```

## `enviarCorreoConfirmacionEquipo`

### Antes

La función `enviarCorreoConfirmacionEquipo` tenía el nombre "Silueta Chic" codificado en el pie de página HTML del correo.

**Pie de página HTML:**
```html
          <p style="font-size: 12px; color: #6b7280;">
            Este es un correo automático del sistema de agendamiento de Silueta Chic.
          </p>
```

### Después

Se modificó para usar la variable `fromName` en el pie de página HTML.

**Pie de página HTML:**
```html
          <p style="font-size: 12px; color: #6b7280;">
            Este es un correo automático del sistema de agendamiento de ${fromName}.
          </p>
```

Estos cambios aseguran que los correos electrónicos reflejen dinámicamente el nombre de la empresa configurado en las variables de entorno.