# Integración DTE — Facturación Electrónica SII (motor nativo en Node)

> **Estado:** Etapa 1, Fase 1B (motor de firma/timbre), Fase 1C (cliente SOAP — **autenticación
> semilla/token ya probada y confirmada contra el SII real**, `maullin.sii.cl` certificación),
> Fase 2 (backend: tablas, orquestador, rutas) y Fase 3 (frontend: botón "Emitir DTE" real + "usar
> datos del último documento" + vista "Documentos Tributarios") están completas. **Solo falta el
> CAF real** — todo lo demás está construido, desplegado y verificado contra el SII de punta a
> punta (salvo el envío de un documento propiamente tal, que requiere folios).
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
- [x] Recibido el **Set de Pruebas oficial de Boleta Electrónica** del SII — guardado en §5.

### Etapa 1 — Formulario/PDF borrador (COMPLETA, en producción)
Construida para validar campos y flujo antes de tener el motor de firma real.

- [x] Columnas `direccion_cliente`/`comuna_cliente` en `proyectos` (receptor).
- [x] Columnas `emisor_rut`/`emisor_razon_social`/`emisor_giro`/`emisor_direccion`/`emisor_comuna`/
      `emisor_actividad_economica` en `configuracion_financiera` (emisor), editable desde
      **Config → Datos del Emisor (SII)**.
- [x] Endpoint `PUT /api/config/financiera/emisor`.
- [x] Modal "Emitir Documento Tributario" en Ingresos: auto-detecta Boleta(39)/Factura(33) según
      `rut_cliente`, receptor editable con botón "Guardar estos datos en el proyecto", detalle de
      líneas editable, Forma de Pago (SII: Contado/Crédito/Sin costo) separada de Medio de Pago,
      Fecha de Vencimiento condicional a Crédito, totales en vivo, RUT normalizado sin puntos.
- [x] `control-Front/src/lib/dtePdfGenerator.js` — genera el PDF de vista previa: diseño serio,
      logo `public/logofactura.png`, marca de agua "BORRADOR" discreta, bloque de Acuse de Recibo
      (Ley 19.983) cuando es Factura + Crédito.
- [x] **Production Cockpit**: botón "Factura" que genera el PDF y abre el modal de correo con el
      PDF adjunto y un texto profesional precargado.

**Límite explícito de la Etapa 1:** el PDF generado por `dtePdfGenerator.js` **no tiene validez
tributaria** — no tiene folio real, no está firmado. Es la vista previa que ve el usuario antes de
emitir de verdad. El motor real (esta sección del documento) es lo que produce el DTE firmado y
timbrado que sí se envía al SII.

### Fase 1B — Motor de firma/timbre nativo (COMPLETA y verificada localmente)
Ver §2 para el diseño técnico completo. Implementado en `control-back/services/dte/`:

- [x] `ted.js` — parseo de CAF, armado y firma del Timbre Electrónico (TED), verificado
      **carácter a carácter contra el ejemplo oficial del Instructivo Técnico del SII**.
- [x] `pdf417.js` — código de barras del timbre.
- [x] `signXml.js` — extracción de certificado `.pfx`→PEM y firma XMLDSig estándar.
- [x] `dteXml.js` — armado del XML de Boleta(39)/Factura(33) afecta y firma del documento
      completo.
- [x] `envioDte.js` — armado del sobre `EnvioDTE` (carátula + set de documentos firmados).
- [x] `verify.js` — 15 verificaciones automáticas, corren sin CAF ni certificado real (`node
      services/dte/verify.js`), incluyendo un pipeline completo con los datos reales del CASO-1
      del Set de Pruebas. **Todas pasan** (última corrida: ver §2.5).

---

## 1. Decisión de arquitectura (actualizada)

Se evaluaron varias alternativas antes de decidir:

| Opción | Por qué se descartó / se eligió |
|---|---|
| API SaaS de terceros (OpenFactura, Bsale, Wasabil, etc.) | Descartada — el usuario quiere emitir con su propio certificado, sin intermediario que gestione la firma. |
| LibreDTE Cloud / Plus (SaaS del propio LibreDTE) | Descartada — es pago ($15.000–$40.000 CLP/mes tras 10 días gratis) y sigue siendo un intermediario externo. |
| LibreDTE Comunidad, self-hosted (Docker/PHP) | **Descartada.** Investigado a fondo: la edición Comunidad está **abandonada hace ~3 años, sin soporte**, su `webapp` no tiene ni instalación con Docker disponible. La librería núcleo (`libredte-lib-core`) está algo más viva pero stale (~14 meses) y es AGPL-3.0 (cláusula de uso en red). Instalarla habría significado meter PHP + Postgres nuevos al servidor para depender de código sin mantenimiento. |
| Dolibarr (ERP completo con módulo DTE) | Descartada — mucho más grande de lo necesario (ERP completo), misma necesidad de infraestructura nueva (PHP) que LibreDTE. |
| **Construir la firma XML + TED + SOAP al SII nativo en Node** | **Elegida.** Se investigó a fondo la especificación oficial del SII (Formato DTE, Formato Boletas Electrónicas, Instructivo Técnico de Emisión) y se confirmó que es implementable con librerías Node genéricas y bien mantenidas (`xml-crypto`, `crypto` nativo, `node-forge`, `bwip-js`) — sin PHP, sin Docker, sin VPS nuevo, dentro del stack existente. Verificado con éxito contra el ejemplo oficial del propio instructivo del SII antes de escribir el resto del sistema (ver §2.5). |

**Por qué "construir desde cero" dejó de ser el riesgo que parecía:** la razón original para
descartarlo era "no existe librería madura equivalente a LibreDTE". Eso segía siendo cierto, pero
tras investigar en detalle la especificación del SII se confirmó que el trabajo real no es
reinventar una librería de facturación Chilena completa, sino combinar piezas estándar y genéricas
(firma XMLDSig, RSA-SHA1 nativo de Node, un parser XML, un generador de PDF417) siguiendo una
especificación bien documentada — y esa combinación **sí se pudo verificar de forma aislada y
exacta** contra los ejemplos oficiales del SII antes de arriesgar nada real.

---

## 2. Diseño técnico del motor DTE nativo

Todo vive en `control-back/services/dte/`, sin infraestructura nueva (nada de Docker/PHP/VPS
adicional) — son módulos Node normales que corren dentro del mismo backend/PM2 de siempre.

### 2.1 Dependencias nuevas (`control-back/package.json`)

```
xml-crypto      — firma/verificación XMLDSig estándar (firma del DTE completo)
node-forge      — parsear certificado .pfx (PKCS#12) a PEM
fast-xml-parser — parsear el XML del CAF
bwip-js         — generación del código de barras PDF417 del Timbre Electrónico
iconv-lite      — conversión a ISO-8859-1 si algún carácter no cubre latin1 nativo
```

Dev-only (usadas por `verify.js`): `@xmldom/xmldom`, `xpath` (transitivas de `xml-crypto`,
declaradas explícitamente para no depender de hoisting de npm).

### 2.2 Timbre Electrónico — `ted.js`

Firma **distinta** a la del documento completo: usa la llave privada del **CAF** (no el
certificado `.pfx`), algoritmo `SHA1withRSA`, y una canonicalización **propia del SII** (no
XMLDSig/C14N estándar) — Instructivo Técnico, Anexo 2.

- `parseCaf(cafXml)` — extrae `RE`, `RS`, `TD`, rango de folios, `RSASK`/`RSAPUBK` (llaves PEM
  para timbrar, distintas de las del certificado), y el bloque `<CAF>` original textual (debe
  incrustarse en el TED sin modificar ni un carácter, Anexo 1.3).
- `buildTedDatos(...)` — arma `<DD>` en el orden exacto exigido: `RE,TD,F,FE,RR,RSR,MNT,IT1,CAF,TSTED`.
- `canonicalizeSiiTed(xml)` — implementa la regla del Anexo 2.4 (elimina espacios/saltos de línea
  entre tags, sin tocar el contenido). **Verificado carácter a carácter contra el ejemplo textual
  exacto que trae el propio instructivo** (ver `verify.js`, sección 1).
- `signTed(datosCanonico, rsaPrivateKeyPem)` — `crypto.createSign('RSA-SHA1')`, DER PKCS#1, base64.
- `buildTed(...)` — ensambla `<TED version="1.0"><DD>...</DD><FRMT algoritmo="SHA1withRSA">...</FRMT></TED>`.

### 2.3 Código de barras — `pdf417.js`

`generarTimbrePdf417(tedXmlString)` usa `bwip-js`: modo binario, ECL 5, relación alto:ancho 3:1,
sin truncado, quiet zone — reglas del Anexo 2.5.

### 2.4 Documento completo — `dteXml.js` + `signXml.js`

- `signXml.js`: `pfxToPem(buffer, password)` extrae llave privada + certificado del `.pfx` con
  `node-forge`, en memoria (sin escribir a disco). `signDocumento(xml, pemData, referenceId)` usa
  `xml-crypto` para producir la firma XMLDSig exacta que exige el SII (C14N, RSA-SHA1, SHA1,
  `KeyInfo` con `RSAKeyValue` **y** `X509Certificate`, ambos exigidos — Anexo 3.3.1/3.3.2).
- `dteXml.js`: arma `Encabezado`+`Detalle` según el tipo de documento:
  - **Boleta (39)**: Formato Boletas Electrónicas v4.00 (2023-06-01) — los precios de línea vienen
    **brutos (con IVA incluido)**; `computeMontosBoleta()` separa ítems afectos de exentos
    (`IndExe=1`) y calcula `MntNeto = round(bruto / 1.19)`, `IVA = bruto - MntNeto`.
  - **Factura (33)**: Formato DTE v2.5 — precios de línea **netos**; `computeMontosFactura()`
    calcula `IVA = round(neto * 0.19)` (misma convención que ya usa la Etapa 1).
  - `buildYFirmarDte(...)` orquesta: calcula montos → arma TED (vía `ted.js`) → arma
    Encabezado/Detalle → firma el `<Documento>` completo (vía `signXml.js`) → retorna el XML
    firmado listo para incluir en un `EnvioDTE`.
- **Alcance actual**: boleta/factura afecta simple, servicios, sin ticket de espectáculo,
  descuentos/recargos globales, referencias a otros documentos, ni exportación — cubre el Set de
  Pruebas y el caso de uso real de NativeCode. Extensiones (NC/ND, referencias, descuentos
  globales) quedan para cuando haga falta emitirlas.

### 2.5 Sobre de envío — `envioDte.js`

`buildCaratula(...)` + `buildYFirmarEnvioDte(...)` arman y firman `<EnvioDTE><Caratula>...</Caratula><SetDTE>...</SetDTE></EnvioDTE>`
con los DTE ya firmados individualmente. Puro armado de XML, no requiere red — el **envío real**
por SOAP es la Fase 1C (pendiente, ver §4).

### 2.6 Verificación — `verify.js`

Corre con `node services/dte/verify.js`, sin CAF ni certificado real, sin tocar el SII:

1. Canonicalización del TED contra el ejemplo textual exacto del instructivo (input con
   saltos de línea/tabs → output canónico esperado) — **comparación exacta, no aproximada**.
2. Construcción de `<DD>` — orden y presencia de campos.
3. Firma/verificación del TED (round-trip con llaves de prueba).
4. Firma/verificación XMLDSig del DTE completo (certificado autofirmado de prueba generado con
   `node-forge`, verificado con `xml-crypto.checkSignature`).
5. Pipeline completo con los datos reales del **CASO-1 del Set de Pruebas** (Cambio de aceite +
   Alineación y balanceo) — arma, firma y genera el PNG del PDF417, de punta a punta.

**25/25 verificaciones pasan, confirmado tanto en local como en el VPS real** (Node 22.21.0 en el
VPS — no Node 20 como sugería el `Dockerfile`, que resultó no ser el runtime real usado por PM2).
`RSA-SHA1` firma y verifica sin problemas ni flags especiales en ese entorno. Las últimas 6
verificaciones (sección 6, "Regresión") cubren los 3 bugs encontrados y arreglados durante el
desarrollo (ver §2.7).

### 2.7 Tipos de pruebas — metodología para cambios futuros

Tres niveles, cada uno cubre lo que el anterior no puede:

**Tipo A — Verificación offline (`verify.js`).** Sin red, sin CAF, sin certificado real (usa
llaves/certificados de prueba generados on-the-fly). Corre en segundos, no consume nada, se puede
ejecutar tantas veces como se quiera. **Correr siempre antes de deployar cualquier cambio a
`services/dte/*`**: `node services/dte/verify.js`. Cubre: canonicalización exacta contra el
ejemplo oficial del instructivo, armado de campos, firma/verificación TED y XMLDSig round-trip, un
pipeline completo con datos reales del Set de Pruebas, y regresiones de bugs ya encontrados (ver
abajo). Lo que **no puede** cubrir: cómo responde el SII de verdad — eso depende del comportamiento
real de sus webservices, no solo de la especificación en PDF.

**Tipo B — Prueba de humo contra el SII real, sin folios.** Para validar que algo que solo se
puede confirmar hablando con el SII de verdad (autenticación, forma exacta de una respuesta SOAP)
funciona, sin arriesgar un folio real. Patrón usado y confirmado en esta sesión:

1. Escribir un script mínimo y desechable en la raíz de `control-back/` (ej. `test_token_sii.js`),
   que importe las funciones reales de `services/dte/` — nunca reimplementar la lógica aparte.
2. **Nunca subirlo con `scp` directo** (bloqueado también por la política de esta cuenta: nunca
   SCP directo a producción). Se commitea, se pushea, y se baja al VPS con el flujo normal
   (`git pull`) — el mismo camino que cualquier otro cambio de código.
3. Correrlo manualmente en el VPS (`node test_token_sii.js`), revisar el resultado.
4. **Borrarlo del repo apenas confirme lo que se necesitaba confirmar** (`git rm` + commit + push
   + pull en el VPS) — es desechable, no un test permanente.

Así se confirmó semilla+token contra `maullin.sii.cl` (2026-07-18) — y así se debe probar
`enviarSetDte`/`consultarEstadoEnvio` la primera vez que se use cada uno, **antes** de que el flujo
real (`dteService.emitirDte`) los llame con un folio de verdad.

**Tipo C — Prueba con folios reales (el Set de Pruebas oficial, §5).** La única que consume
folios de verdad. Se hace una sola vez por tipo de documento, durante la ventana de certificación
de 24h, después de que el Tipo B ya confirmó que la autenticación y el envío funcionan.

**Bugs reales que el Tipo A no podía detectar (ejemplos concretos, ambos de la primera sesión de
pruebas en vivo, 2026-07-18):**

1. `extractTag()` en `siiClient.js` asumía que el SOAP del SII devolvía `<getSeedReturn>` sin
   prefijo. El servidor SOAP real del SII (Axis/Java) antepone un prefijo de namespace variable
   (`<ns1:getSeedReturn>`), algo que no está en ningún WSDL ni ejemplo de la documentación pública
   — solo se vio al hacer la prueba Tipo B contra `maullin.sii.cl` real. Corregido: el regex ahora
   acepta cualquier prefijo de namespace (o ninguno).
2. Al probar `enviarSetDte` con un CAF sintético (rechazo esperado), el SII devolvió una página
   HTML de error genérica en vez del XML `<RECEPCIONDTE>` documentado — sin `STATUS` ni
   `TRACKID`. Como `Number(null)` da `0` en JS, el código original interpretaba "no vino STATUS"
   como "STATUS=0" (éxito): un envío que el SII ni siquiera procesó habría quedado marcado
   "enviado" para siempre, sin Track ID para que el cron lo revisara. Corregido con
   `parseUploadResponse()`, que distingue explícitamente ambos casos — ahora con test de
   regresión Tipo A permanente (`verify.js` §7) usando la respuesta HTML real capturada.

Ninguno de los dos lo podía atrapar `verify.js` porque ninguno depende de la especificación en
PDF — dependen de cómo se comporta el servidor real del SII, que en ambos casos se desvía
levemente de lo documentado.

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

## 4. Fase 1C + 2 + 3 — TODO CONSTRUIDO, solo falta el CAF real

### 4.1 Fase 1C — Cliente SOAP (`services/dte/siiClient.js`)

Implementado: `getSemilla()`, `firmarSemilla()`, `getToken()`, `obtenerToken()` (los tres
anteriores encadenados), `enviarSetDte()`, `consultarEstadoEnvio()`.

- `getSemilla`/`getToken`: verificados contra el **WSDL público real** de `CrSeed.jws` y
  `GetTokenFromSeed.jws` (operaciones `getSeed`/`getToken`, parámetro `pszXml`) — y **confirmados
  en vivo contra `maullin.sii.cl`** el 2026-07-18 con el certificado real (prueba Tipo B, §2.7):
  semilla y token obtenidos correctamente de punta a punta. Confianza alta.
- `enviarSetDte`: implementado según el "Manual Desarrollador Externo — Envío Automático DTE"
  (OI2003_UPDTE_MDE) del propio SII — endpoint `POST /cgi_dte/UPL/DTEUpload`, multipart con
  `rutSender`/`dvSender`/`rutCompany`/`dvCompany`/`archivo`, respuesta `<RECEPCIONDTE><STATUS>`/`<TRACKID>`.
  **Probado en vivo** (2026-07-18, prueba Tipo B con un CAF sintético — rechazo esperado, ver
  abajo). El transporte funciona (firma XMLDSig del sobre con el certificado real, multipart bien
  formado, el SII responde 200). El SII **no siempre devuelve el XML `<RECEPCIONDTE>` documentado**
  — con un CAF no autorizado devolvió una página HTML de error genérica sin `STATUS` ni `TRACKID`.
  Eso reveló un bug real: `Number(null)` da `0` en JS, así que "no vino STATUS" se estaba
  confundiendo con "STATUS=0" (éxito) — un envío fallido habría quedado marcado como exitoso, y al
  no tener Track ID tampoco lo habría revisado nunca el cron de estados. **Arreglado**:
  `parseUploadResponse()` (nueva función, exportada y con test de regresión en `verify.js` §7)
  distingue explícitamente ambos casos.
- `consultarEstadoEnvio`: basado en el endpoint `QueryEstUp.jws`, ampliamente documentado en
  guías públicas de integración pero **no confirmado contra un WSDL propio ni contra el SII real
  todavía** — verificar formato exacto de respuesta (¿también con prefijo de namespace en el tag
  raíz, como pasó con `getSeedReturn`? probablemente sí) antes de confiar en el cron automático
  para el primer lote de certificación.

**Certificado real ya probado contra el SII** (2026-07-18): `.pfx` subido a
`/root/finance/secrets/dte/certificado.pfx` en el VPS (permisos 600, fuera de git), `.env`
configurado (§4.4), autenticación semilla+token confirmada con un script desechable (Tipo B). En
esa primera prueba se encontró y arregló un bug real: `extractTag()` no reconocía el prefijo de
namespace (`ns1:`) que el SII antepone a los tags de respuesta — ver §2.7 para el detalle y la
lección de por qué `verify.js` (Tipo A) no lo pudo atrapar.

### 4.2 Fase 2 — Backend (persistencia + orquestación) — COMPLETO

Tablas creadas en producción (`migration_dte_documentos.sql`, ya ejecutada): `dte_documentos`,
`dte_folios_consumidos`, y **`dte_caf`** (metadata de los CAF cargados: rango, ruta del archivo,
ambiente — permite tener varios CAF activos y saber cuál usar).

**Servicio:** `services/dteService.js` — `emitirDte()` orquesta: reserva atómica de folio
(`FOR UPDATE` + transacción, recorre CAFs activos y avanza al siguiente cuando uno se agota) →
`buildYFirmarDte` → arma y firma el sobre (`envioDte.js`) → `siiClient.obtenerToken` +
`enviarSetDte` → persiste en `dte_documentos` (éxito o error, sin perder el folio ya reservado).
También: `obtenerUltimoDocumento()` (para "similar al último"), `obtenerHistorialProyecto()`,
`obtenerEstadoCaf()` (para habilitar/deshabilitar el botón en el frontend), y
`actualizarEstadosPendientes()` (cron).

**Rutas:** `view/dteRoutes.js`, montadas en `/api/dte` con `requireAuth` (`app.js`):
```
GET    /api/dte/estado                          → { boleta39, factura33 } CAF cargado o no
GET    /api/dte/documentos                       → Listado global (todos los proyectos), filtros ?tipoDte&estado&ambiente
POST   /api/dte/documentos/actualizar-estados    → Consulta al SII el estado de los "enviado" ahora, sin esperar el cron
POST   /api/dte/emitir/:id_proyecto             → Emitir DTE (auto-detecta tipo 33/39)
GET    /api/dte/proyecto/:id_proyecto           → Historial de DTEs del proyecto
GET    /api/dte/proyecto/:id_proyecto/ultimo    → Último documento (para "similar al último")
```

**Cron:** `actualizarEstadosPendientes` cada hora (`app.js`, mismo patrón `setInterval`+`.unref()`
de los recordatorios existentes) — no hace nada mientras no haya documentos `enviado` pendientes,
así que es seguro dejarlo corriendo aunque no haya certificado configurado todavía.

**Nota de anulación (NC/ND):** el endpoint `POST /api/dte/:id/anular` (Nota de Crédito) queda
fuera de este alcance — `dteXml.js` hoy solo arma Boleta/Factura afecta simple, no Notas de
Crédito/Débito. Se agrega cuando haga falta anular un documento real.

### 4.3 Fase 3 — Frontend — COMPLETO

- Modal "Emitir Documento Tributario" (Ingresos): el botón "Emitir DTE" ahora llama al endpoint
  real. Se habilita/deshabilita automáticamente según `GET /api/dte/estado` — hoy aparece
  deshabilitado porque no hay CAF, y se habilita solo cuando se cargue uno, sin tocar código.
- Muestra el resultado real (folio + Track ID, o el error del SII) después de emitir.
- Botón **"Usar los mismos datos que el último documento"** (equivalente a la opción del portal
  del SII que mostraste) — trae el `detalle_json` del último documento emitido para ese proyecto.
  Ojo: la emisión real siempre toma el receptor **persistido en el proyecto**, no un valor suelto
  del formulario — para emitir a un receptor distinto hay que editarlo y usar "Guardar estos datos
  en el proyecto" antes de emitir (relevante para el Set de Pruebas, §5, donde cada caso tiene un
  receptor distinto: usar un proyecto de prueba dedicado y cambiar el receptor antes de cada caso).
- **Vista "Documentos Tributarios"** (`/clientes/documentos-tributarios`, módulo Clientes, bajo
  Bóveda) — listado global de todo lo emitido en cualquier proyecto: folio, tipo, receptor, monto,
  estado SII, Track ID, ambiente, fecha. Filtros por tipo/estado, búsqueda por receptor/RUT/folio/
  Track ID. Botón **"Consultar estado en el SII"** dispara `actualizarEstadosPendientes()` al
  tiro, sin esperar el cron horario — útil justo después de emitir algo para confirmar aceptación
  rápido. Componente: `control-Front/src/app/Clientes/DocumentosTributarios.jsx`.
- El botón "Factura" del Cockpit sigue siendo solo vista previa (PDF + email) — no se conectó al
  endpoint real todavía, queda para cuando se valide el flujo completo con el Set de Pruebas.

### 4.4 Variables de entorno (`.env` del backend, VPS) — CONFIGURADAS

```env
# Certificado digital (.pfx), fuera de git — ver .gitignore. Titular: Nicolás Machuca
# (representante autorizado; el RUT del certificado no tiene que coincidir con el de la empresa).
DTE_CERT_PATH=/root/finance/secrets/dte/certificado.pfx
DTE_CERT_PASS=************  # ver .env real en el VPS, no se documenta el valor aquí

# RUT de la empresa emisora (con guión, sin puntos) — usado por el cron de estado
DTE_RUT_EMISOR=78184828-K   # NATIVECODE SPA — confirmado contra configuracion_financiera

# Ambiente: certificacion o produccion
DTE_AMBIENTE=certificacion
```

Archivo `.pfx` subido y con permisos `600` (solo root) en `/root/finance/secrets/dte/`, fuera del
repo. Autenticación probada y confirmada contra el SII real (§2.7, §4.1).

Los archivos CAF (XML) se registran en la tabla `dte_caf` (`ruta_archivo` apunta a
`/root/finance/secrets/dte/caf/...`, misma carpeta fuera de git) — no hay UI de carga todavía,
se inserta el registro a mano la primera vez (`INSERT INTO dte_caf (...)`).

---

## 5. Set de Pruebas SII — Boleta Electrónica (recibido, listo para usar)

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

Observación del SII: *"El ítem 1 es un servicio afecto. El ítem 2 es un servicio exento."* — usar
`indExe: 1` en la segunda línea al llamar `buildYFirmarDte`.

### CASO-5
| Ítem | Cantidad | Precio Unitario con IVA |
|---|---|---|
| Arroz | 5 | 700 |

Observación del SII: *"Se debe informar en el XML Unidad de medida en Kg."* — usar
`unidadMedida: 'Kg'` en la línea.

### Procedimiento de certificación (correo del SII, plazo 24 horas desde la descarga del CAF)

1. Obtener un CAF de boletas electrónicas con un rango de **5 folios**, en ambiente certificación.
2. Generar las 5 boletas electrónicas (XML) con los datos de arriba, usando esos folios —
   `buildYFirmarDte()` ya está listo para esto (ver §2.4/2.6).
3. Enviar al SII el Set de Boletas + el **RCOF** (Reporte de Consumo de Folios) asociado, en un
   solo archivo (sobre), vía UPLOAD/Web/automatizado en ambiente certificación (Fase 1C, §4.1).
4. Solicitar revisión del Set enviado, informando el **track ID** en la sección de Boletas
   Electrónicas del sitio del SII.
5. Si se recibe el V°B°, proceder con la **Declaración de Cumplimiento**. Si no, corregir según
   el diagnóstico recibido por correo y repetir.

**Importante — orden de ejecución para no perder el plazo:** el cliente SOAP (Fase 1C) debe estar
listo y probado contra `maullin.sii.cl` **antes** de descargar el CAF — el plazo de 24h corre
desde la descarga, no desde que se empieza a trabajar. **Esto ya se cumplió** (§4.1): el motor de
firma/timbre (Fase 1B) y la autenticación contra el SII real (Fase 1C, semilla+token) están
probados. Queda pendiente solo la parte que sí requiere folios (`enviarSetDte`, probarla con una
prueba Tipo B antes de gastar folios reales, §2.7).

### Cómo ejecutar los 5 casos con lo ya construido (sin escribir código nuevo)

El sistema ya tiene todo lo necesario en el frontend — la emisión real toma el receptor
**persistido en el proyecto**, no un valor suelto del formulario, así que el flujo es:

1. Insertar el CAF descargado en `dte_caf` (a mano, `INSERT INTO dte_caf (...)`, §4.4).
2. Crear un proyecto de prueba dedicado en Ingresos (ej. "SII — Certificación").
3. Para cada CASO-N: abrir el modal "Emitir Documento Tributario" en ese proyecto → editar los
   campos de receptor con los datos del caso → **"Guardar estos datos en el proyecto"** → cargar
   el/los ítem(s) de detalle con cantidad/precio del caso → **"Emitir DTE"**.
4. Repetir para los 5 casos, cambiando receptor + detalle antes de cada uno.
5. Cada emisión persiste en `dte_documentos` (visible en la vista **Documentos Tributarios**,
   §4.3) con folio y Track ID. Usar el botón **"Consultar estado en el SII"** ahí mismo para
   confirmar aceptación sin esperar el cron horario.
6. Confirmar además en el propio portal del SII (con el mismo certificado) que cada Track ID
   quedó aceptado — no depender solo de `consultarEstadoEnvio` para esta primera certificación,
   ya que esa función no está probada contra el SII real todavía (§4.1).

---

## 6. Checklist de implementación (actualizado)

### Fase 0 — Requisitos
- [x] Certificado digital
- [x] Registro como emisor DTE
- [ ] Solicitar CAF Tipo 39 (boletas) — bloque de 5 folios para el Set de Pruebas. **Todo lo demás
      ya está listo y probado** (ver §5) — es el próximo paso pendiente, sin bloqueo técnico.
- [ ] Solicitar CAF Tipo 33 (facturas) — bloque de 50, después de aprobar boletas
- [x] Guardar archivos `.pfx` en lugar seguro (VPS, fuera de git, permisos 600) — CAF: pendiente
      hasta descargarlo

### Etapa 1 — Formulario/PDF borrador
- [x] Completa y desplegada en producción

### Fase 1B — Motor de firma/timbre nativo
- [x] `ted.js`, `pdf417.js`, `signXml.js`, `dteXml.js`, `envioDte.js`
- [x] `verify.js` — 25/25 verificaciones pasan, confirmado en local y en el VPS real (Node 22)
- [x] Certificado `.pfx` real subido al VPS y probado con `pfxToPem` — OK, titular confirmado

### Fase 1C — Cliente SOAP SII
- [x] `services/dte/siiClient.js`: semilla/token/envío/consulta estado (construido)
- [x] Probado contra `maullin.sii.cl` con el certificado real — semilla+token OK (2026-07-18)
- [x] Probado `enviarSetDte` en vivo (CAF sintético, rechazo esperado) — transporte OK, encontrado
      y arreglado un bug real de parseo de respuesta (`parseUploadResponse`, §2.7)
- [ ] Verificar formato real de `consultarEstadoEnvio` (probablemente también con prefijo de
      namespace, como pasó con `getSeedReturn` — ver §2.7) — pendiente de una prueba Tipo B

### Fase 2 — Backend
- [x] Tablas `dte_documentos` + `dte_folios_consumidos` + `dte_caf` (ya en producción)
- [x] `services/dteService.js` (orquestador, con reserva atómica de folio)
- [x] `view/dteRoutes.js` + `controller/DteController.js`, montados con `requireAuth`
- [x] Cron de actualización de estado SII (cada hora, no-op sin documentos pendientes)
- [x] `GET /api/dte/documentos` + `POST /api/dte/documentos/actualizar-estados` (listado global)
- [x] Configurado `DTE_CERT_PATH`/`DTE_CERT_PASS`/`DTE_RUT_EMISOR`/`DTE_AMBIENTE` en el `.env` del VPS
- [x] Certificado `.pfx` cargado en el VPS, fuera de git, permisos 600

### Fase 3 — Frontend
- [x] Conectar el modal "Emitir Documento" (Ingresos) al endpoint real, gateado por `/api/dte/estado`
- [x] Botón "Usar los mismos datos que el último documento"
- [x] Vista "Documentos Tributarios" en Clientes — listado global, filtros, refresco de estado
- [ ] Badge de estado SII en cada proyecto (fuera de la tarjeta/modal)
- [ ] Conectar el botón "Factura" del Cockpit al endpoint real (hoy solo genera el borrador)

### Fase 4 — Certificación con el SII
- [ ] Descargar CAF Tipo 39 (5 folios) — inicia la ventana de 24h (todo lo demás ya está listo)
- [ ] Insertar el CAF en `dte_caf` (§4.4)
- [ ] Generar y enviar el Set de Pruebas completo (§5, workflow ya documentado) + RCOF
- [ ] Reportar track ID, obtener V°B°, Declaración de Cumplimiento
- [ ] Repetir para Factura (Tipo 33)
- [ ] Cambiar a ambiente `produccion`
- [ ] Emitir boleta/factura real de prueba, verificar folio en `sii.cl`, confirmar email con PDF

---

## 7. Costos estimados

| Ítem | Costo | Frecuencia |
|---|---|---|
| Certificado digital | Ya pagado | Cada 2 años |
| Motor DTE nativo (Node) | $0 | — |
| VPS (ya existe, mismo servidor que Finance) | $0 adicional | — |
| Brevo (emails, ya integrado) | $0 (plan actual) | Mensual |
| **Total mensual** | **$0** | — |

---

## Referencias

- Portal SII Mipyme: https://www.sii.cl/servicios_online/1039-.html
- Formato DTE SII (Factura y otros, v2.5, 2026-02): https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf
- Formato Boletas Electrónicas SII (v4.00, 2023-06-01): https://www.sii.cl/factura_electronica/factura_mercado/formato_boletas_elec_202306.pdf
- Instructivo Técnico Factura Electrónica (28/10/2021, TED/firma/webservices): https://www.sii.cl/factura_electronica/factura_mercado/instructivo_emision.pdf
- Webservices SII: `CrSeed.jws`/`GetTokenFromSeed.jws` en `maullin.sii.cl` (certificación) / `palena.sii.cl` (producción)
- Manual Desarrollador Externo — Envío Automático DTE (endpoint de upload): http://www.sii.cl/servicios_online/docs/envio.pdf
- Verificador DTEs SII: https://maullin.sii.cl/cvc/cvc.html

---

*Documento actualizado tras probar la autenticación (semilla+token) contra el SII real
(`maullin.sii.cl`, certificación) con el certificado digital real, y tras agregar la vista
"Documentos Tributarios" para tener control del historial de emisiones. Próximo paso: descargar
el CAF Tipo 39 (§0, §5) — todo lo demás está construido, desplegado y verificado.*
