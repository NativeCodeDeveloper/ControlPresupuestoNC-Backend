# 📧 Sistema de Recordatorios Automáticos de Citas - Silueta Chic

## 📋 Índice
1. [¿Qué es este sistema?](#-qué-es-este-sistema)
2. [¿Qué es un Cron Job?](#-qué-es-un-cron-job-explicación-simple)
3. [¿Cómo funciona el sistema?](#-cómo-funciona-el-sistema)
4. [Flujo de trabajo completo](#-flujo-de-trabajo-completo)
5. [Archivos involucrados](#-archivos-involucrados)
6. [Configuración de la base de datos](#-configuración-de-la-base-de-datos)
7. [Implementación en producción](#-implementación-en-producción)
8. [Pruebas y verificación](#-pruebas-y-verificación)
9. [Solución de problemas](#-solución-de-problemas)

---

## 🤔 ¿Qué es este sistema?

Este sistema envía **correos electrónicos automáticos** a los pacientes para recordarles sus citas. Los recordatorios se envían en dos momentos:

| Momento | Descripción |
|---------|-------------|
| **12 horas antes** | Primer recordatorio |
| **6 horas antes** | Segundo recordatorio (más urgente) |

### Ejemplo práctico:
Si un paciente tiene una cita el **4 de febrero a las 10:00 AM**:
- Recibirá el **primer correo** el 3 de febrero a las **10:00 PM** (12 horas antes)
- Recibirá el **segundo correo** el 4 de febrero a las **4:00 AM** (6 horas antes)

---

## ⏰ ¿Qué es un Cron Job? (Explicación Simple)

### Imagina esto:
Un **Cron Job** es como un **despertador programado** para tu servidor. 

Así como tú programas una alarma para que suene todos los días a las 7:00 AM, un Cron Job es una tarea que el servidor ejecuta automáticamente en intervalos de tiempo que tú defines.

### Analogía del empleado responsable:
Imagina que tienes un empleado muy responsable que:

```
🕐 Cada 5 minutos:
   1. Revisa la agenda de citas
   2. Busca citas que están próximas (entre 5.5 y 12.5 horas)
   3. Si encuentra una cita a 12 horas → Envía primer recordatorio
   4. Si encuentra una cita a 6 horas → Envía segundo recordatorio
   5. Anota que ya envió el recordatorio (para no enviarlo dos veces)
   6. Vuelve a dormir 5 minutos
   7. Repite desde el paso 1...
```

**Ese empleado incansable es el Cron Job.**

### En términos técnicos:
En nuestro sistema usamos `setInterval()` de JavaScript, que ejecuta una función cada cierto tiempo:

```javascript
// Esto se ejecuta cada 5 minutos (300,000 milisegundos)
setInterval(async () => {
    await ejecutarRecordatoriosAutomaticos();
}, 5 * 60 * 1000);
```

---

## 🔄 ¿Cómo funciona el sistema?

### Diagrama Visual del Flujo:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVIDOR BACKEND                                 │
│                                                                          │
│   ┌─────────────┐                                                        │
│   │  CRON JOB   │ ← Se ejecuta automáticamente cada 5 minutos           │
│   │ (setInterval)│                                                        │
│   └──────┬──────┘                                                        │
│          │                                                               │
│          ▼                                                               │
│   ┌──────────────────────────────┐                                       │
│   │ ejecutarRecordatoriosAutomaticos() │                                 │
│   └──────────────┬───────────────┘                                       │
│                  │                                                       │
│                  ▼                                                       │
│   ┌──────────────────────────────┐                                       │
│   │   CONSULTAR BASE DE DATOS    │                                       │
│   │   (buscar citas próximas)    │                                       │
│   └──────────────┬───────────────┘                                       │
│                  │                                                       │
│          ┌───────┴───────┐                                               │
│          │               │                                               │
│          ▼               ▼                                               │
│   ┌─────────────┐ ┌─────────────┐                                        │
│   │ ¿Faltan 12h?│ │ ¿Faltan 6h? │                                        │
│   │ ¿Ya envié?  │ │ ¿Ya envié?  │                                        │
│   └──────┬──────┘ └──────┬──────┘                                        │
│          │               │                                               │
│          ▼               ▼                                               │
│   ┌─────────────┐ ┌─────────────┐                                        │
│   │   ENVIAR    │ │   ENVIAR    │                                        │
│   │  CORREO 12h │ │  CORREO 6h  │                                        │
│   └──────┬──────┘ └──────┬──────┘                                        │
│          │               │                                               │
│          ▼               ▼                                               │
│   ┌─────────────┐ ┌─────────────┐                                        │
│   │   MARCAR    │ │   MARCAR    │                                        │
│   │  ENVIADO    │ │  ENVIADO    │                                        │
│   │   EN BD     │ │   EN BD     │                                        │
│   └─────────────┘ └─────────────┘                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │      API BREVO        │
              │  (servicio de correo) │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    📧 PACIENTE        │
              │    recibe correo      │
              └───────────────────────┘
```

---

## 📊 Flujo de trabajo completo

### PASO 1: Paciente agenda una cita
```
Paciente llena formulario → Se guarda en BD → Campos de recordatorio en 0:
   - recordatorio12h = 0 (no enviado)
   - recordatorio6h = 0 (no enviado)
```

### PASO 2: El Cron Job revisa constantemente
```
Cada 5 minutos el sistema hace esto:

1. Obtiene la hora actual (ejemplo: 3 de febrero, 10:00 PM)

2. Busca en la BD todas las citas que están entre 0 y 13 horas en el futuro:
   SELECT * FROM reservaPacientes 
   WHERE la_cita_esta_entre_0_y_13_horas_en_el_futuro

3. Para cada cita encontrada calcula los minutos restantes:
   - Cita: 4 de febrero 10:00 AM
   - Ahora: 3 de febrero 10:00 PM
   - Minutos restantes: 720 (12 horas exactas)

4. Evalúa si debe enviar recordatorio:
   
   ┌─ ¿Minutos entre 690 y 750? (rango de 12h ± 30min)
   │   Y ¿recordatorio12h = 0?
   │   
   │   SÍ → Enviar correo de 12h
   │        Marcar recordatorio12h = 1 en BD
   │   
   └─ ¿Minutos entre 330 y 390? (rango de 6h ± 30min)
       Y ¿recordatorio6h = 0?
       
       SÍ → Enviar correo de 6h
            Marcar recordatorio6h = 1 en BD
```

### PASO 3: Paciente recibe el correo
```
El correo llega con:
   - Nombre del paciente
   - Fecha y hora de la cita
   - Dirección de la clínica
   - Mensaje de recordatorio profesional
```

### ¿Por qué usamos un rango de ±30 minutos?

El Cron Job se ejecuta cada 5 minutos, no cada segundo. Para asegurar que **nunca se pierda un recordatorio**, usamos un rango:

```
Recordatorio de 12 horas:
   - Rango: Entre 690 minutos (11.5h) y 750 minutos (12.5h)
   - Si el Cron se ejecuta a las 11:57 horas antes → ✅ Captura la cita
   - Si el Cron se ejecuta a las 12:03 horas antes → ✅ Captura la cita

Recordatorio de 6 horas:
   - Rango: Entre 330 minutos (5.5h) y 390 minutos (6.5h)
```

---

## 📁 Archivos involucrados

### 1. `services/notificacionPreviaDia.js` (ARCHIVO PRINCIPAL)

Este archivo contiene toda la lógica del sistema:

| Función | ¿Qué hace? |
|---------|------------|
| `ejecutarRecordatoriosAutomaticos()` | Función principal que ejecuta todo el proceso |
| `enviarCorreoRecordatorio()` | Envía el correo usando la API de Brevo |
| `marcarRecordatorioEnviado()` | Actualiza la BD marcando que ya se envió |
| `obtenerReservasParaRecordatorio()` | Consulta las reservas próximas en la BD |
| `enviarRecordatorioManual()` | Para enviar recordatorios de prueba |

### 2. `app.js` (Archivo principal del servidor)

Aquí se inicia el Cron Job cuando arranca el servidor:

```javascript
// Importación
import {ejecutarRecordatoriosAutomaticos} from "./notificacionPreviaDia.js";

// Ruta para ejecutar manualmente (útil para pruebas)
app.get('/recordatorios/ejecutar', async (req, res) => {
    const resultado = await ejecutarRecordatoriosAutomaticos();
    res.json({ok: true, ...resultado});
});

// CRON JOB automático cada 5 minutos
setInterval(async () => {
    await ejecutarRecordatoriosAutomaticos();
}, 5 * 60 * 1000);
```

### 3. `model/ReservaPacientes.js`

El modelo de datos para las reservas (ya existente).

### 4. `.env`

Variables de entorno necesarias:

```env
# API de correos (Brevo)
BREVO_API_KEY=tu_api_key_aqui
CORREO_RECEPTOR=tu_correo@dominio.com
NOMBRE_EMPRESA=SiluetaChic
```

---

## 🗄️ Configuración de la base de datos

### Campos necesarios en la tabla `reservaPacientes`:

Debes ejecutar este SQL **una sola vez**:

```sql
ALTER TABLE reservaPacientes 
ADD COLUMN recordatorio12h TINYINT(1) DEFAULT 0;

ALTER TABLE reservaPacientes 
ADD COLUMN recordatorio6h TINYINT(1) DEFAULT 0;
```

### ¿Qué significan estos campos?

| Campo | Valor 0 | Valor 1 |
|-------|---------|---------|
| `recordatorio12h` | No se ha enviado | Ya se envió |
| `recordatorio6h` | No se ha enviado | Ya se envió |

### ¿Por qué son necesarios?

Para **evitar correos duplicados**. Si el sistema ya envió el recordatorio de 12 horas, marca `recordatorio12h = 1` y **nunca lo vuelve a enviar** para esa cita.

---

## 🚀 Implementación en producción

### Opción 1: Usando PM2 (RECOMENDADO) ⭐

**PM2** es un programa que mantiene tu aplicación Node.js siempre corriendo, incluso si hay errores o si el servidor se reinicia.

#### Paso 1: Conectarse al servidor
```bash
ssh tu_usuario@tu_servidor.com
```

#### Paso 2: Instalar PM2 (una sola vez)
```bash
npm install -g pm2
```

#### Paso 3: Ir a la carpeta del backend
```bash
cd /ruta/donde/esta/tu/backend
# Ejemplo: cd /var/www/siluetachic-backend
```

#### Paso 4: Iniciar la aplicación con PM2
```bash
pm2 start app.js --name "siluetachic-backend"
```

#### Paso 5: Hacer que inicie automáticamente al reiniciar el servidor
```bash
pm2 startup
pm2 save
```

#### Paso 6: Verificar que está funcionando
```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs siluetachic-backend

# Ver los últimos 100 logs
pm2 logs siluetachic-backend --lines 100
```

### Comandos útiles de PM2:

| Comando | ¿Qué hace? |
|---------|------------|
| `pm2 status` | Ver estado de todas las aplicaciones |
| `pm2 logs siluetachic-backend` | Ver logs en tiempo real |
| `pm2 restart siluetachic-backend` | Reiniciar la aplicación |
| `pm2 stop siluetachic-backend` | Detener la aplicación |
| `pm2 delete siluetachic-backend` | Eliminar la aplicación de PM2 |

---

### Opción 2: Usando systemd (Linux avanzado)

Si prefieres usar el sistema nativo de Linux:

#### Paso 1: Crear archivo de servicio
```bash
sudo nano /etc/systemd/system/siluetachic.service
```

#### Paso 2: Pegar esta configuración
```ini
[Unit]
Description=SiluetaChic Backend
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/tu/backend
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Paso 3: Activar el servicio
```bash
sudo systemctl daemon-reload
sudo systemctl enable siluetachic
sudo systemctl start siluetachic
```

#### Paso 4: Verificar
```bash
sudo systemctl status siluetachic
```

---

## 🔧 Configuración del .env en producción

Asegúrate de que tu archivo `.env` en el servidor de producción tenga:

```env
# Base de datos (ajustar según tu servidor)
DB_HOST=localhost
DB_USER=tu_usuario_bd
DB_PASS=tu_contraseña_bd
DB_DATABASE=comercioElectronico
DB_PORT=3306

# API de correos (Brevo) - IMPORTANTE
BREVO_API_KEY=xkeysib-tu-api-key-completa-aqui
CORREO_RECEPTOR=correo@tudominio.com
NOMBRE_EMPRESA=SiluetaChic

# URL del backend (para los enlaces en los correos)
BACKEND_URL=https://api.tudominio.com
```

---

## 🧪 Pruebas y verificación

### Prueba 1: Ejecutar manualmente desde el navegador

Visita esta URL en tu navegador:
```
http://localhost:3001/recordatorios/ejecutar
```

O en producción:
```
https://tu-backend.com/recordatorios/ejecutar
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "enviados": 0,
  "errores": 0
}
```

### Prueba 2: Ver los logs

Con PM2:
```bash
pm2 logs siluetachic-backend
```

**Logs esperados:**
```
[RECORDATORIO] ========================================
[RECORDATORIO] Iniciando proceso de recordatorios...
[RECORDATORIO] Fecha/Hora actual: 03-02-2026, 5:00:19 p. m.
[RECORDATORIO] Encontradas 2 reserva(s) próxima(s)
[RECORDATORIO] Procesando reserva 123: Juan Pérez - 720 minutos restantes
[RECORDATORIO] Enviando recordatorio de 12h a juan@email.com...
[RECORDATORIO] Correo de 12h enviado a juan@email.com
[RECORDATORIO] Marcado 12h para reserva 123
[RECORDATORIO] Proceso finalizado. Enviados: 1, Errores: 0
[RECORDATORIO] ========================================
```

### Prueba 3: Verificar en la base de datos

```sql
SELECT 
  id_reserva, 
  nombrePaciente, 
  fechaInicio, 
  horaInicio,
  recordatorio12h, 
  recordatorio6h 
FROM reservaPacientes 
WHERE fechaInicio >= CURDATE()
ORDER BY fechaInicio, horaInicio;
```

---

## 🛠️ Solución de problemas

### ❌ Problema: No se envían correos

**Verificar:**
1. ¿Está configurada `BREVO_API_KEY` en `.env`?
2. ¿El servidor tiene acceso a internet?
3. ¿Los campos `recordatorio12h` y `recordatorio6h` existen en la tabla?

**Comando para verificar:**
```bash
curl http://localhost:3001/recordatorios/ejecutar
```

### ❌ Problema: Se envían correos duplicados

**Verificar:**
1. ¿Los campos de la BD se están actualizando correctamente?

**Consulta SQL para verificar:**
```sql
SELECT id_reserva, nombrePaciente, recordatorio12h, recordatorio6h 
FROM reservaPacientes 
WHERE fechaInicio >= CURDATE();
```

### ❌ Problema: El Cron Job no se ejecuta

**Verificar:**
1. ¿El servidor está corriendo? → `pm2 status`
2. ¿Hay errores en los logs? → `pm2 logs`
3. ¿El `setInterval` está en `app.js`?

---

## 📧 Ejemplo del correo que recibe el paciente

**Asunto:** `Recordatorio de cita programada - 12 horas restantes`

```
────────────────────────────────────────
⏰ Recordatorio de Cita
Faltan 12 horas para tu cita
────────────────────────────────────────

Estimado/a Juan Pérez:

Junto con saludarle, queremos recordarle que mantiene 
una cita agendada según el siguiente detalle:

📅 Fecha: miércoles, 4 de febrero de 2026
⏰ Hora: 10:00
📍 Lugar: SILUETA CHIC, Avenida Irarrázaval 1989 
         OF 204 SUR, Ñuñoa, Santiago, Chile

⚠️ Importante: Le solicitamos, por favor, no olvidar 
asistir a su cita en el horario indicado. En caso de 
no poder concurrir, le agradeceremos avisar con 
anticipación para poder reprogramarla y así liberar 
el cupo para otro paciente.

Quedamos atentos/as ante cualquier consulta o confirmación.

Atentamente,
Silueta Chic
────────────────────────────────────────
```

---

## ✅ Checklist de implementación

Marca cada paso cuando lo completes:

- [ ] 1. Ejecutar SQL para agregar campos `recordatorio12h` y `recordatorio6h`
- [ ] 2. Verificar que `.env` tiene `BREVO_API_KEY` configurado
- [ ] 3. Subir los cambios al servidor de producción
- [ ] 4. Instalar PM2 en el servidor (`npm install -g pm2`)
- [ ] 5. Iniciar el backend con PM2 (`pm2 start app.js --name "siluetachic-backend"`)
- [ ] 6. Configurar inicio automático (`pm2 startup` y `pm2 save`)
- [ ] 7. Probar manualmente (`/recordatorios/ejecutar`)
- [ ] 8. Verificar logs (`pm2 logs`)
- [ ] 9. Crear una cita de prueba y esperar el recordatorio

---

## 📝 Resumen de comandos

| Acción | Comando |
|--------|---------|
| Iniciar servidor | `pm2 start app.js --name "siluetachic-backend"` |
| Ver estado | `pm2 status` |
| Ver logs | `pm2 logs siluetachic-backend` |
| Reiniciar | `pm2 restart siluetachic-backend` |
| Detener | `pm2 stop siluetachic-backend` |
| Probar recordatorios | `curl http://localhost:3001/recordatorios/ejecutar` |

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica las variables de entorno
3. Comprueba el estado de la base de datos

---

*Documentación creada el 3 de febrero de 2026*
*Sistema de Recordatorios Automáticos v1.0*
*Silueta Chic - NativeCode*
