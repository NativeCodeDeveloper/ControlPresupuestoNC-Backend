# Integración DTE — Facturación Electrónica SII (LibreDTE)

> **Estado:** Etapa 1 (formulario + PDF borrador) completa y desplegada. Fase 1 (infraestructura
> LibreDTE) es el próximo paso — decisiones ya tomadas, falta ejecutar.
> **Objetivo:** Emitir boletas electrónicas (Tipo 39) y facturas electrónicas (Tipo 33) desde
> NativeCode Finance, validadas por el SII, directamente al registrar un pago o desde el
> Production Cockpit.

---

## 0. Progreso real (actualizado)

### Fase 0 — Requisitos
- [x] Certificado digital del representante legal — **ya obtenido**.
- [x] Registro como emisor DTE ante el SII — **ya habilitado**. Confirmado además por correo del
      SII: *"la empresa ya se encuentra autorizada para descargar CAF de boletas electrónicas en
      el ambiente de certificación"*.
- [ ] CAF Tipo 39 (boletas) — **pendiente, lo solicita el usuario cuando esté todo listo** (ver
      §5, hay una ventana de 24 horas desde la descarga).
- [ ] CAF Tipo 33 (facturas) — pendiente.
- [x] Recibido el **Set de Pruebas oficial de Boleta Electrónica** del SII — guardado en §5, listo
      para usar apenas tengamos LibreDTE + CAF.

### Etapa 1 — Formulario/PDF borrador (COMPLETA, en producción)
Construida y desplegada antes de tener LibreDTE, para validar campos y flujo sin depender de la
infraestructura pesada. Ver también commits `be222c7`, `02e06f3`, `0b6ad81`, `2d1bb8c`, `d4e22e8`,
`fec3e04` en los repos de backend/frontend.

- [x] Columnas `direccion_cliente`/`comuna_cliente` en `proyectos` (receptor).
- [x] Columnas `emisor_rut`/`emisor_razon_social`/`emisor_giro`/`emisor_direccion`/`emisor_comuna`/
      `emisor_actividad_economica` en `configuracion_financiera` (emisor), editable desde
      **Config → Datos del Emisor (SII)**.
- [x] Endpoint `PUT /api/config/financiera/emisor`.
- [x] Modal "Emitir Documento Tributario" en Ingresos: auto-detecta Boleta(39)/Factura(33) según
      `rut_cliente`, receptor editable con botón "Guardar estos datos en el proyecto", detalle de
      líneas editable, Forma de Pago (SII: Contado/Crédito/Sin costo) separada de Medio de Pago,
      Fecha de Vencimiento condicional a Crédito, totales en vivo, RUT normalizado sin puntos.
- [x] `control-Front/src/lib/dtePdfGenerator.js` — genera el PDF de vista previa: diseño serio
      (blanco/negro/gris, sin colores llamativos), logo `public/logofactura.png`, marca de agua
      "BORRADOR" discreta, bloque de Acuse de Recibo (Ley 19.983) cuando es Factura + Crédito.
      Expone `computeDteTotals`, `generateDtePreview` (descarga) y `generateDteFile` (retorna
      `File` para adjuntar a un correo sin descargar).
- [x] **Production Cockpit**: botón "Factura" que genera el PDF y abre el modal de correo
      (`sendCockpitEmail`, ya soporta adjuntos base64) con el PDF adjunto y un texto profesional
      precargado, incluyendo aviso de que es una vista previa hasta que exista el documento
      timbrado por el SII.

**Importante — límite explícito de la Etapa 1:** el PDF generado **no tiene validez tributaria**.
No tiene folio real, no está firmado, no pasó por el SII. Es una maqueta de contenido para validar
campos y flujo antes de conectar la parte real (esta sección del documento).

---

## 1. Decisión de arquitectura para Fase 1 (tomada en esta sesión)

Se evaluaron varias alternativas antes de decidir:

| Opción | Por qué se descartó / se eligió |
|---|---|
| API SaaS de terceros (OpenFactura, Bsale, Wasabil, etc.) | Descartada — el usuario quiere emitir con su propio certificado, sin intermediario que gestione la firma. |
| LibreDTE Cloud / Plus (SaaS del propio LibreDTE) | Descartada — es pago ($15.000–$40.000 CLP/mes tras 10 días gratis) y sigue siendo un intermediario externo. |
| Construir la firma XML + TED + SOAP al SII desde cero en Node | Descartada por ahora — no existe librería Node madura y gratuita equivalente a LibreDTE; alto riesgo de rechazo por errores de firma/formato sin una librería probada por miles de emisores detrás. |
| Dolibarr (ERP completo con módulo DTE) | Descartada — mucho más grande de lo necesario (ERP completo), misma necesidad de infraestructura nueva (PHP) que LibreDTE. |
| **LibreDTE Comunidad, self-hosted** | **Elegida.** Open source, gratis para siempre (sin trial), madura, la única opción que cumple "sin intermediarios, con nuestro certificado". |

**Docker vs instalación nativa:** LibreDTE **no exige Docker** — el requisito real es PHP +
Composer + una base de datos (Postgres). Docker es una elección de empaquetado, no una exigencia
del software. Se usará Docker igual porque en un servidor de producción es más fácil de aislar y
desinstalar sin dejar rastro si algo falla, pero es reversible: si en algún momento se prefiere
nativo, el resultado final (un servicio HTTP interno) es el mismo.

**¿Mismo VPS que Finance, o uno separado?** Se evaluó separar en un VPS nuevo por el riesgo de
tocar el servidor donde vive Finance. Decisión final: **se instala en el mismo VPS**
(`72.61.35.232`, junto a `finance-back` en PM2), porque:
- Los otros procesos del servidor (`macarrepuestos`, `runajoyas`) son de prueba, no negocios reales
  con datos de clientes en juego — el único riesgo real es sobre el propio Finance.
- LibreDTE **no se expone a internet**: queda escuchando en `localhost` (o detrás de firewall),
  solo el backend Node de Finance le habla, server-to-server. El frontend (Vercel) y el acceso
  remoto de cualquier usuario/colega no cambian en nada — siguen hablando con la misma API de
  siempre.
- Si LibreDTE llegara a fallar, el único impacto es que el botón "Emitir Factura" deja de
  funcionar puntualmente; el resto de la app (proyectos, pagos, reportes, cockpit, etc.) sigue
  operando normal, porque son procesos independientes bajo PM2/Docker.
- El contenedor se configura con `restart: always`, igual de confiable que PM2 para los procesos
  Node existentes.

---

## 2. LibreDTE — Instalación en VPS

Se instala en el mismo VPS donde corre el backend (`72.61.35.232`).
LibreDTE expone una API REST que el backend de NativeCode consume internamente (no pública).

### 2.1 Requisitos del servidor

- Docker y Docker Compose (a instalar — confirmado que **no** está instalado hoy).
- PostgreSQL (LibreDTE usa Postgres, no MySQL) — corre en su propio contenedor, aislado de
  `finance_db` (MySQL).
- ~512MB RAM adicionales (el servidor tiene 3.8GB total, con margen de sobra).
- Puerto 8080 libre para LibreDTE (confirmado libre), 5432 para Postgres (confirmado libre,
  además corre solo dentro de la red interna de Docker, no expuesto al host).
- Puertos 80/443 ya ocupados por nginx (las apps existentes) — sin conflicto, LibreDTE no los usa.

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
LIBREDTE_RUT_EMISOR=78184828-K

# Ruta al certificado digital
LIBREDTE_CERT_PATH=/certs/certificado.pfx
LIBREDTE_CERT_PASS=CLAVE_DEL_CERTIFICADO

# Ambiente: certificacion (pruebas) o produccion
LIBREDTE_AMBIENTE=certificacion
```

```bash
docker-compose up -d
```

**Exposición del servicio (importante, ver §1):** el puerto 8080 se publica solo en
`127.0.0.1:8080` (no `0.0.0.0:8080`), o se agrega una regla de firewall (`ufw`) que bloquee acceso
externo a ese puerto — así queda accesible únicamente desde el propio backend Node del servidor.

### 2.3 Configuración inicial

1. Acceder a la interfaz de LibreDTE (vía túnel SSH o desde el propio servidor, dado que el
   puerto no está expuesto públicamente).
2. Cargar el certificado digital (`.pfx`).
3. Cargar los archivos CAF por tipo de documento (39 primero, según el Set de Pruebas recibido).
4. Configurar datos del emisor (razón social, giro, dirección, actividad económica) — ya los
   tenemos guardados en `configuracion_financiera` (Etapa 1), se replican acá.
5. Generar y enviar el Set de Pruebas (ver §5) en ambiente `certificacion`.

---

## 3. Tipos de Documentos

| Tipo | Código SII | Para quién | Requiere RUT cliente |
|---|---|---|---|
| Boleta Electrónica | 39 | Personas naturales | No |
| Factura Electrónica | 33 | Empresas / RUT empresa | Sí |
| Nota de Crédito Electrónica | 61 | Anular/corregir ambos | Sí |

**Lógica de auto-detección** (ya implementada en el frontend, Etapa 1):

```
si rut_cliente existe y no es nulo → Factura Electrónica (Tipo 33)
si no → Boleta Electrónica (Tipo 39)
```

---

## 4. Plan de Implementación Backend (Fase 2 — pendiente)

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
1. Obtener datos del proyecto (nombre_cliente, rut_cliente, monto, etc.) — ya disponibles
   completos gracias a la Etapa 1 (direccion_cliente, comuna_cliente incluidos).
2. Determinar tipo DTE (33 o 39) — misma lógica ya usada en el frontend.
3. POST a LibreDTE API (localhost:8080) → /api/dte/emitir
4. LibreDTE firma XML y envía al SII
5. SII devuelve Track ID
6. Guardar en tabla dte_documentos
7. Descargar PDF (real, timbrado) desde LibreDTE — reemplaza el PDF "borrador" de
   dtePdfGenerator.js para el flujo de emisión real (la Etapa 1 se mantiene como vista previa
   antes de emitir, no se descarta).
8. Enviar PDF + XML al email del cliente vía Brevo — reutilizando el EmailModal del Cockpit y
   sendCockpitEmail ya construidos en la Etapa 1, solo cambiando el adjunto por el PDF real.
9. Retornar resultado al frontend.
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

## 5. Set de Pruebas SII — Boleta Electrónica (recibido, guardado para cuando tengamos CAF)

> Documento oficial del SII, "SET DE PRUEBA DE BOLETA ELECTRÓNICA DE VENTAS Y SERVICIOS".
> Se omitieron tildes en el original para evitar problemas de lectura.

**Indicaciones generales del SII:**
- Para datos del contribuyente (giro, razón social, direcciones, sucursales, Dirección Regional o
  Unidad) consultar en "Mi SII". No usar abreviaciones en los giros.
- Informar cifras con separador de miles; los caracteres deben ir tal cual aparecen en el Set.
- Cada boleta debe referenciar su caso correspondiente en el XML:
  ```xml
  <CodRef>SET</CodRef>
  <RazonRef>CASO-1</RazonRef>
  ```

### CASO-1
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Cambio de aceite | 1 | 19.900 |
| Alineación y balanceo | 1 | 9.900 |

### CASO-2
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Papel de regalo | 17 | 120 |

### CASO-3
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Sandwich | 2 | 1.500 |
| Bebida | 2 | 550 |

### CASO-4
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Ítem afecto 1 | 8 | 1.590 |
| Ítem exento 2 | 2 | 1.000 |

Observación del SII: *"El ítem 1 es un servicio afecto. El ítem 2 es un servicio exento."*

### CASO-5
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Arroz | 5 | 700 |

Observación del SII: *"Se debe informar en el XML Unidad de medida en Kg."*

### Procedimiento de certificación (correo del SII, plazo 24 horas desde la descarga del CAF)

1. Obtener un CAF de boletas electrónicas con un rango de **5 folios**, en ambiente certificación.
2. Generar las 5 boletas electrónicas (XML) con los datos de arriba, usando esos folios.
3. Enviar al SII el Set de Boletas + el **RCOF** (Reporte de Consumo de Folios) asociado, en un
   solo archivo (sobre), vía UPLOAD/Web/automatizado en ambiente certificación.
4. Solicitar revisión del Set enviado, informando el **track ID** en la sección de Boletas
   Electrónicas del sitio del SII.
5. Si se recibe el V°B°, proceder con la **Declaración de Cumplimiento**. Si no, corregir según
   el diagnóstico recibido por correo y repetir.

**Importante — orden de ejecución para no perder el plazo:** LibreDTE debe estar instalado,
configurado con el certificado, y listo para generar+firmar+enviar **antes** de descargar el CAF
— el plazo de 24h corre desde la descarga, no desde que se empieza a trabajar.

---

## 6. Plan de Implementación Frontend (Fase 3 — pendiente)

La mayor parte de la UI ya existe (Etapa 1). Lo que falta es *reemplazar* el flujo de borrador por
el real una vez haya folios:

- En el modal "Emitir Documento Tributario" (Ingresos) y en el botón "Factura" del Cockpit:
  agregar la llamada real a `POST /api/dte/emitir/:id_proyecto` en lugar de (o además de) generar
  el PDF borrador — mostrar folio real, estado SII, y habilitar el botón "Emitir DTE" que hoy está
  deshabilitado con el tooltip "Requiere CAF del SII (pendiente)".
- Badge de estado SII (`Pendiente SII` / `Aceptado` / `Rechazado`) en cada proyecto.
- Sección nueva "Documentos Tributarios" en Finance: listado de DTEs emitidos, filtros, descarga
  masiva, alerta si algún documento queda `rechazado`/`observado`.

---

## 7. Checklist de implementación (actualizado)

### Fase 0 — Requisitos
- [x] Certificado digital
- [x] Registro como emisor DTE
- [ ] Solicitar CAF Tipo 39 (boletas) — bloque de 5 folios para el Set de Pruebas, **hacerlo recién
      cuando LibreDTE esté instalado y listo** (ver §5)
- [ ] Solicitar CAF Tipo 33 (facturas) — bloque de 50, después de aprobar boletas
- [ ] Guardar archivos `.pfx` y CAF en lugar seguro

### Etapa 1 — Formulario/PDF borrador
- [x] Completa y desplegada en producción

### Fase 1 — Infraestructura
- [ ] Instalar Docker + Docker Compose en el VPS (mismo servidor que Finance, puerto 8080 solo
      interno)
- [ ] Instalar LibreDTE con Docker Compose
- [ ] Configurar certificado y CAFs en LibreDTE
- [ ] Emitir las 5 boletas del Set de Pruebas en ambiente `certificacion`
- [ ] Enviar Set + RCOF, obtener track ID, reportarlo al SII
- [ ] Obtener V°B° y hacer Declaración de Cumplimiento
- [ ] Repetir el proceso para Factura (Tipo 33) cuando corresponda
- [ ] Cambiar a ambiente `produccion`

### Fase 2 — Backend
- [ ] Crear tabla `dte_documentos`
- [ ] Implementar `services/dteService.js`
- [ ] Crear `view/dteRoutes.js` con endpoints protegidos
- [ ] Agregar cron para actualizar estados SII (cada hora)
- [ ] Tests de integración con LibreDTE

### Fase 3 — Frontend
- [ ] Conectar el modal/botón "Emitir Documento" existente al endpoint real
- [ ] Badge de estado SII en cada proyecto
- [ ] Sección "Documentos Tributarios" en Finance
- [ ] Descarga de PDF real desde la plataforma

### Fase 4 — Validación
- [ ] Emitir boleta de prueba real a email interno
- [ ] Verificar folio en `sii.cl` (validación pública)
- [ ] Emitir factura de prueba
- [ ] Verificar anulación con nota de crédito
- [ ] Confirmar llegada del email con PDF adjunto (reusando EmailModal del Cockpit)

---

## 8. Estimación de tiempo de desarrollo

| Fase | Estimado |
|---|---|
| Fase 0 (CAF, ya con cert/registro listos) | Inmediato una vez se decide pedirlo |
| Fase 1 (infraestructura + certificación con Set de Pruebas) | 1-2 días |
| Fase 2 (backend) | 3-4 días |
| Fase 3 (frontend, gran parte ya construida en Etapa 1) | 1 día |
| Fase 4 (validación) | 1 día |
| **Total restante** | **~6-8 días** |

---

## 9. Costos estimados

| Ítem | Costo | Frecuencia |
|---|---|---|
| Certificado digital | Ya pagado | Cada 2 años |
| LibreDTE Comunidad self-hosted | $0 | — |
| VPS (ya existe, mismo servidor que Finance) | $0 adicional | — |
| Brevo (emails, ya integrado) | $0 (plan actual) | Mensual |
| **Total mensual** | **$0** | — |

---

## Referencias

- Portal SII Mipyme: https://www.sii.cl/servicios_online/1039-.html
- LibreDTE GitHub (Comunidad): https://github.com/LibreDTE/libredte-webapp
- LibreDTE Ediciones (Comunidad vs Enterprise): https://www.libredte.cl/editions
- Documentación LibreDTE API: https://developers.libredte.cl
- Verificador DTEs SII: https://maullin.sii.cl/cvc/cvc.html
- Formato DTE SII (v2.5, 2026-02): https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf

---

*Documento actualizado en la sesión de integración de LibreDTE — decisiones de arquitectura,
progreso de Etapa 1 y Set de Pruebas SII documentados. Próximo paso: ejecutar Fase 1.*
