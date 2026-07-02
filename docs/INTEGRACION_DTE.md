# Integración DTE — Facturación Electrónica SII (LibreDTE)

> **Estado:** Pendiente — requiere certificado digital antes de iniciar.
> **Objetivo:** Emitir boletas electrónicas (Tipo 39) y facturas electrónicas (Tipo 33) desde
> NativeCode Finance, validadas por el SII, directamente al registrar un pago o desde el
> Production Cockpit.

---

## 1. Prerrequisitos (tramitar antes de implementar)

### 1.1 Certificado Digital del Representante Legal

El SII exige que cada DTE esté firmado con el certificado digital del representante legal
de la empresa. Sin esto, no se puede emitir ningún documento tributario electrónico.

**Dónde tramitarlo:**

| Proveedor | Costo aprox. | Vigencia | URL |
|---|---|---|---|
| E-CertChile | $35-50 USD | 2 años | ecertchile.cl |
| CertiSur | $30-45 USD | 2 años | certisur.cl |

**Qué se necesita para tramitarlo:**
- RUT y cédula de identidad del representante legal
- RUT de la empresa (NativeCode)
- Correo corporativo activo
- El proceso toma 1-3 días hábiles

**Resultado:** Archivo `.pfx` o `.p12` (certificado + llave privada) y su contraseña.

### 1.2 Registro como Emisor DTE ante el SII

La empresa debe habilitarse como emisor de documentos tributarios electrónicos.

**Pasos:**
1. Ingresar a `mipyme.sii.cl` con el RUT de la empresa y clave tributaria
2. Ir a **Servicios Online → Factura Electrónica → Administrador de Documentos Tributarios**
3. Solicitar habilitación como emisor DTE
4. El SII activará el RUT en 24-48 horas hábiles

> Este paso es gratuito y obligatorio independiente del proveedor técnico que se use.

### 1.3 CAF (Código de Autorización de Folios)

Los folios son los números correlativos de cada documento. El SII los autoriza en bloques.

- Se solicitan en el mismo portal `mipyme.sii.cl`
- Se piden por separado para cada tipo de documento (Tipo 33, Tipo 39, Tipo 61)
- Resultado: archivo XML con los folios autorizados (se carga en LibreDTE)
- Recomendado: solicitar bloques de 100-500 folios para empezar

---

## 2. LibreDTE — Instalación en VPS

Se instala en el mismo VPS donde corre el backend (`72.61.35.232`).
LibreDTE expone una API REST que el backend de NativeCode consume.

### 2.1 Requisitos del servidor

- Docker y Docker Compose (ya disponible o instalar)
- PostgreSQL (LibreDTE usa Postgres, no MySQL)
- ~512MB RAM adicionales
- Puerto 8080 libre (o el que se configure)

### 2.2 Instalación con Docker

```bash
# En el VPS, como root
git clone https://github.com/LibreDTE/libredte-api-client.git /root/libredte
cd /root/libredte

# Crear archivo de configuración
cp .env.example .env
nano .env
```

**Variables de entorno clave en `.env`:**

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=libredte_db
DB_USER=libredte
DB_PASS=CONTRASEÑA_SEGURA

# RUT de la empresa emisora (sin puntos, con guión)
LIBREDTE_RUT_EMISOR=12345678-9

# Ruta al certificado digital
LIBREDTE_CERT_PATH=/certs/certificado.pfx
LIBREDTE_CERT_PASS=CLAVE_DEL_CERTIFICADO

# Ambiente: certificacion (pruebas) o produccion
LIBREDTE_AMBIENTE=certificacion
```

```bash
docker-compose up -d
```

### 2.3 Configuración inicial

1. Acceder a `http://72.61.35.232:8080` con usuario admin
2. Cargar el certificado digital (`.pfx`)
3. Cargar los archivos CAF por tipo de documento
4. Configurar datos del emisor (razón social, giro, dirección, actividad económica)
5. Hacer prueba con documento de certificación ante el SII

---

## 3. Tipos de Documentos

| Tipo | Código SII | Para quién | Requiere RUT cliente |
|---|---|---|---|
| Boleta Electrónica | 39 | Personas naturales | No |
| Factura Electrónica | 33 | Empresas / RUT empresa | Sí |
| Nota de Crédito Electrónica | 61 | Anular/corregir ambos | Sí |

**Lógica de auto-detección** (basada en datos existentes en `proyectos`):

```
si rut_cliente existe y no es nulo → Factura Electrónica (Tipo 33)
si no → Boleta Electrónica (Tipo 39)
```

---

## 4. Plan de Implementación Backend

### 4.1 Tabla nueva: `dte_documentos`

```sql
CREATE TABLE dte_documentos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto     INT NOT NULL,
    id_pago         INT,
    tipo_dte        TINYINT NOT NULL COMMENT '33=Factura, 39=Boleta, 61=NC',
    folio           INT NOT NULL,
    track_id        VARCHAR(50),
    estado_sii      ENUM('pendiente','aceptado','rechazado','observado') DEFAULT 'pendiente',
    monto_neto      DECIMAL(12,2),
    monto_iva       DECIMAL(12,2),
    monto_total     DECIMAL(12,2),
    pdf_url         VARCHAR(500),
    xml_path        VARCHAR(500),
    emitido_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo          TINYINT(1) NOT NULL DEFAULT 1,
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_estado (estado_sii)
);
```

### 4.2 Servicio: `services/dteService.js`

```js
// Funciones principales a implementar:
export async function emitirBoleta(idProyecto, monto, descripcion) { ... }
export async function emitirFactura(idProyecto, monto, descripcion) { ... }
export async function anularDocumento(idDte)                        { ... }
export async function consultarEstadoSII(trackId)                   { ... }
export async function enviarDteEmail(idDte, email)                  { ... }
```

**Flujo interno de `emitirBoleta` / `emitirFactura`:**

```
1. Obtener datos del proyecto (nombre_cliente, rut_cliente, monto, etc.)
2. Determinar tipo DTE (33 o 39)
3. POST a LibreDTE API → /api/dte/emitir
4. LibreDTE firma XML y envía al SII
5. SII devuelve Track ID
6. Guardar en tabla dte_documentos
7. Descargar PDF desde LibreDTE
8. Enviar PDF + XML al email del cliente vía Brevo
9. Retornar resultado al frontend
```

### 4.3 Endpoints nuevos en `view/dteRoutes.js`

```
POST   /api/dte/emitir/:id_proyecto     → Emitir DTE (auto-detecta tipo)
GET    /api/dte/proyecto/:id_proyecto   → Historial de DTEs de un proyecto
GET    /api/dte/:id/pdf                 → Descargar PDF del DTE
POST   /api/dte/:id/reenviar-email      → Reenviar DTE por email
POST   /api/dte/:id/anular              → Emitir nota de crédito (anulación)
GET    /api/dte/:id/estado-sii          → Consultar estado en SII
```

---

## 5. Plan de Implementación Frontend

### 5.1 Production Cockpit — cambios

**En cada fila de proyecto con pago registrado:**
- Botón `Generar DTE` (ícono recibo/documento)
- Badge con estado: `Pendiente SII` / `Aceptado` / `Rechazado`
- Link para descargar el PDF

**Modal de emisión:**
```
Cliente: Patricia Lopez
Documento: ○ Boleta Electrónica   ● Factura Electrónica
Monto: $150.000
Descripción: Servicio de desarrollo web - Enero 2026
IVA (19%): $23.739
Total: $173.739
[ Cancelar ]  [ Emitir DTE ]
```

### 5.2 Sección nueva: `Documentos Tributarios`

Vista dedicada en el módulo Finance con:
- Listado de todos los DTEs emitidos (folio, cliente, monto, estado SII)
- Filtros por tipo, estado, período
- Descarga masiva (para el contador)
- Alerta cuando un DTE está en estado `rechazado` u `observado`

---

## 6. Flujos de Emisión

### Flujo A — Manual desde el Cockpit

```
Usuario hace click en "Generar DTE"
  → Modal confirma datos (tipo, monto, descripción)
  → POST /api/dte/emitir/:id_proyecto
    → dteService crea el documento en LibreDTE
    → LibreDTE envía al SII (Track ID)
    → Se guarda en dte_documentos
    → PDF enviado al email del cliente automáticamente
  → Toast: "DTE emitido. Folio #1234 — Pendiente validación SII"
  → El estado se actualiza a "Aceptado" cuando el SII confirma (cron cada hora)
```

### Flujo B — Automático al registrar pago

```
Se registra pago en proyecto
  → Hook post-pago llama a dteService.emitirAutomatico()
  → Mismo flujo que Flujo A
  → Email al cliente incluye PDF del DTE adjunto
```

---

## 7. Integración con email (Brevo)

El DTE se adjunta al correo del cliente usando el sistema de adjuntos base64 ya implementado:

```js
// En dteService.js
const pdfBase64 = await obtenerPdfBase64(trackId);
await sendBrevoEmail({
    to: emailCliente,
    subject: `Documento Tributario Electrónico — Folio #${folio}`,
    htmlContent: buildDteEmailHtml({ cliente, folio, monto, tipo }),
    attachment: [{ content: pdfBase64, name: `DTE_${folio}.pdf` }]
});
```

---

## 8. Checklist de implementación

### Fase 0 — Requisitos (HACER PRIMERO)
- [ ] Tramitar certificado digital (E-CertChile / CertiSur)
- [ ] Registrar empresa como emisor DTE en `mipyme.sii.cl`
- [ ] Solicitar CAF Tipo 39 (boletas) — bloque de 100
- [ ] Solicitar CAF Tipo 33 (facturas) — bloque de 50
- [ ] Guardar archivos `.pfx` y CAF en lugar seguro

### Fase 1 — Infraestructura
- [ ] Instalar LibreDTE en VPS con Docker
- [ ] Configurar certificado y CAFs en LibreDTE
- [ ] Emitir 3-5 documentos de prueba en ambiente `certificacion`
- [ ] Verificar documentos de prueba en `mipyme.sii.cl`
- [ ] Cambiar a ambiente `produccion`

### Fase 2 — Backend
- [ ] Crear tabla `dte_documentos`
- [ ] Implementar `services/dteService.js`
- [ ] Crear `view/dteRoutes.js` con endpoints protegidos
- [ ] Agregar cron para actualizar estados SII (cada hora)
- [ ] Tests de integración con LibreDTE

### Fase 3 — Frontend
- [ ] Botón "Generar DTE" en Production Cockpit
- [ ] Modal de confirmación con auto-detección boleta/factura
- [ ] Badge de estado SII en cada proyecto
- [ ] Sección "Documentos Tributarios" en Finance
- [ ] Descarga de PDF desde la plataforma

### Fase 4 — Validación
- [ ] Emitir boleta de prueba real a email interno
- [ ] Verificar folio en `sii.cl` (validación pública)
- [ ] Emitir factura de prueba
- [ ] Verificar anulación con nota de crédito
- [ ] Confirmar llegada del email con PDF adjunto

---

## 9. Estimación de tiempo de desarrollo

| Fase | Estimado |
|---|---|
| Fase 0 (trámites) | 3-5 días hábiles (depende del SII) |
| Fase 1 (infraestructura) | 1 día |
| Fase 2 (backend) | 3-4 días |
| Fase 3 (frontend) | 2-3 días |
| Fase 4 (validación) | 1 día |
| **Total desarrollo** | **~7-9 días una vez tramitado el certificado** |

---

## 10. Costos estimados

| Ítem | Costo | Frecuencia |
|---|---|---|
| Certificado digital | $35-50 USD | Cada 2 años |
| LibreDTE self-hosted | $0 | — |
| VPS (ya existe) | $0 adicional | — |
| Brevo (emails, ya integrado) | $0 (plan actual) | Mensual |
| **Total mensual** | **$0** | — |
| **Total setup** | **~$35-50 USD** | Una vez |

---

## Referencias

- Portal SII Mipyme: https://www.sii.cl/servicios_online/1039-.html
- LibreDTE GitHub: https://github.com/LibreDTE
- Documentación LibreDTE API: https://developers.libredte.cl
- Verificador DTEs SII: https://maullin.sii.cl/cvc/cvc.html
- E-CertChile: https://www.e-certchile.cl
- CertiSur: https://www.certisur.com/chile

---

*Documento generado por NativeCode — Actualizar cuando se inicien los trámites.*
