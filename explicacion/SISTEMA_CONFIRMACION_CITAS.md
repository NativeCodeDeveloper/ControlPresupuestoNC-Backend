# Sistema de Confirmación/Cancelación de Citas por Email

## 📧 Descripción General

Este sistema permite a los pacientes **confirmar o cancelar** sus citas directamente desde el correo de confirmación que reciben al agendar una cita.

---

## 🎯 Funcionalidades

### 1. **Correo de Confirmación al Paciente**
Cuando un paciente agenda una cita, recibe un correo con:
- ✅ Botón **"Confirmar Cita"** (verde)
- ❌ Botón **"Cancelar Cita"** (rojo)
- Detalles completos de la reserva
- Instrucciones de preparación y políticas de asistencia

### 2. **Notificación Automática al Equipo**
Cuando el paciente hace clic en alguno de los botones:
- Se envía un correo automático a: `desarrollo.native.code@gmail.com`
- El correo incluye:
  - Nombre del paciente
  - ID de la reserva
  - Fecha y hora de la cita
  - Acción realizada (CONFIRMADA o CANCELADA)

### 3. **Página de Confirmación**
Después de hacer clic en el botón, el paciente ve una página web con:
- Mensaje de éxito visual
- Confirmación de la acción realizada
- Detalles de su cita

---

## 🛠️ Componentes del Sistema

### **Backend**

#### 1. **Controller: `NotificacionAgendamientoController.js`**
Maneja las peticiones HTTP para confirmar/cancelar:
- `confirmarCita(req, res)` - Endpoint GET para confirmar
- `cancelarCita(req, res)` - Endpoint GET para cancelar

#### 2. **Routes: `notificacionAgendamientoRoutes.js`**
Define las rutas:
- `GET /notificacion/confirmar` - Confirma una cita
- `GET /notificacion/cancelar` - Cancela una cita

#### 3. **Service: `notificacionAgendamiento.js`**
Métodos principales:
- `enviarCorreoConfirmacionReserva()` - Envía correo al paciente con botones
- `enviarCorreoConfirmacionEquipo()` - Notifica al equipo sobre la acción del paciente

---

## 📋 Flujo de Funcionamiento

### **Paso 1: Paciente Agenda una Cita**
```
Usuario → Formulario Web → Backend → Base de Datos
                                   ↓
                            Envía Correo al Paciente
```

### **Paso 2: Paciente Recibe Correo**
```
Email con Botones:
┌─────────────────────────────┐
│  ✅ Confirmar Cita          │
│  ❌ Cancelar Cita           │
└─────────────────────────────┘
```

### **Paso 3: Paciente Hace Clic en un Botón**
```
Botón → URL con Parámetros → Backend Endpoint
                                      ↓
                              1. Envía email al equipo
                              2. Muestra página de confirmación
```

---

## 🔗 URLs de los Endpoints

### Confirmar Cita
```
GET http://localhost:3001/notificacion/confirmar?id_reserva=123&nombrePaciente=Juan&apellidoPaciente=Pérez&fechaInicio=2026-02-10&horaInicio=10:00
```

### Cancelar Cita
```
GET http://localhost:3001/notificacion/cancelar?id_reserva=123&nombrePaciente=Juan&apellidoPaciente=Pérez&fechaInicio=2026-02-10&horaInicio=10:00
```

---

## 📧 Ejemplos de Correos

### Correo al Paciente (Confirmación Inicial)
```html
¡Tu cita con Silueta Chic ha sido confirmada! 🎉

Detalle de tu reserva:
• RUT: 12.345.678-9
• Teléfono: +56 9 1234 5678
• Inicio: 2026-02-10 10:00
• Término: 2026-02-10 11:00
• Estado: reservada

[✅ Confirmar Cita]  [❌ Cancelar Cita]
```

### Correo al Equipo (Después de Confirmación)
```
✅ Cita CONFIRMADA por Juan Pérez

• ID Reserva: 123
• Fecha: 2026-02-10
• Hora: 10:00

El paciente confirmó desde el enlace del correo.
```

### Correo al Equipo (Después de Cancelación)
```
❌ Cita CANCELADA por Juan Pérez

• ID Reserva: 123
• Fecha: 2026-02-10
• Hora: 10:00

El paciente canceló desde el enlace del correo.
```

---

## ⚙️ Configuración Requerida

### Variables de Entorno (.env)
```env
BREVO_API_KEY=tu_api_key_de_brevo
CORREO_RECEPTOR=tuemail@ejemplo.com
NOMBRE_EMPRESA=SiluetaChic
API_URL=http://localhost:3001
```

### Requisitos
- Node.js 18+ (para usar `fetch` nativo)
- Cuenta en Brevo (antes Sendinblue) para envío de emails
- MySQL con tabla `reservaPacientes`

---

## 🧪 Cómo Probar

### 1. Crear una Reserva de Prueba
```bash
# Hacer una petición POST para crear una reserva
curl -X POST http://localhost:3001/reservaPacientes/insertarReservaPacienteFicha \
  -H "Content-Type: application/json" \
  -d '{
    "nombrePaciente": "Juan",
    "apellidoPaciente": "Pérez",
    "rut": "12345678-9",
    "telefono": "+56912345678",
    "email": "tu_email@ejemplo.com",
    "fechaInicio": "2026-02-10",
    "horaInicio": "10:00",
    "fechaFinalizacion": "2026-02-10",
    "horaFinalizacion": "11:00",
    "estadoReserva": "reservada"
  }'
```

### 2. Revisar el Correo Recibido
- Verifica tu bandeja de entrada
- Haz clic en "Confirmar Cita" o "Cancelar Cita"

### 3. Verificar la Notificación al Equipo
- Revisa la bandeja de `desarrollo.native.code@gmail.com`
- Deberías ver un correo con la confirmación/cancelación

---

## 🎨 Personalización

### Cambiar el Destinatario del Correo al Equipo
En `notificacionAgendamiento.js`, línea ~176:
```javascript
const destinatario = "tu_nuevo_email@ejemplo.com";
```

### Modificar los Estilos de las Páginas de Confirmación
En `NotificacionAgendamientoController.js`:
- Busca la sección `<style>` en los métodos `confirmarCita` y `cancelarCita`
- Ajusta colores, fuentes y layout según tu marca

### Cambiar los Colores de los Botones en el Email
En `notificacionAgendamiento.js`, busca:
```javascript
// Botón Confirmar (verde)
background: #10b981

// Botón Cancelar (rojo)
background: #ef4444
```

---

## 📊 Base de Datos

El sistema requiere que la tabla `reservaPacientes` tenga:
- `id_reserva` (PRIMARY KEY, AUTO_INCREMENT)
- `nombrePaciente`
- `apellidoPaciente`
- `rut`
- `telefono`
- `email`
- `fechaInicio`
- `horaInicio`
- `fechaFinalizacion`
- `horaFinalizacion`
- `estadoReserva`

---

## 🐛 Troubleshooting

### El correo no se envía
1. Verifica que `BREVO_API_KEY` esté configurada correctamente
2. Revisa que el email en `CORREO_RECEPTOR` esté verificado en Brevo
3. Chequea los logs del backend: `console.log("[MAIL] ...")`

### Los botones no funcionan
1. Verifica que `API_URL` en `.env` sea la URL correcta del backend
2. Asegúrate de que el backend esté corriendo
3. Revisa que las rutas estén registradas en `app.js`

### La página de confirmación no se muestra
1. Verifica que no haya errores en el navegador (F12 → Console)
2. Revisa que los parámetros en la URL estén correctos
3. Chequea los logs del backend para ver si hay errores

---

## 📝 Notas Adicionales

- Los correos son enviados de forma asíncrona para no bloquear la respuesta al usuario
- Si el envío de correo falla, el sistema sigue funcionando (la reserva se crea igual)
- Los errores de envío se registran en los logs del backend
- Los botones en el email son enlaces (GET), no formularios (POST)

---

## 🚀 Próximas Mejoras

- [ ] Agregar un estado en la base de datos para "confirmado" vs "pendiente"
- [ ] Enviar recordatorios automáticos 24h antes de la cita
- [ ] Permitir reprogramar la cita desde el email
- [ ] Dashboard para ver estadísticas de confirmaciones/cancelaciones
- [ ] Integración con WhatsApp para notificaciones adicionales

---

¡Sistema implementado exitosamente! 🎉
