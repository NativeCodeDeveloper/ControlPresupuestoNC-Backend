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
- [x] **CAF Tipo 39 (boletas) — descargado y cargado** (2026-07-19, ambiente certificación, folios
      1-5). Ventana de 24h corriendo desde la descarga — emitir los 5 casos del Set de Boleta
      (§5.12) pronto. **Track de certificación independiente** del Set de §5.0-5.11.
- [x] **CAF Tipo 33 (facturas) — descargado y cargado** (2026-07-19, certificación, folios 1-5).
- [x] **CAF Tipo 61 (Nota de Crédito) y 56 (Nota de Débito) — descargados y cargados** (2026-07-19,
      certificación, folios 1-5 cada uno) — alcanza para los 8 casos del SET BASICO (§5.1).
- [ ] CAF Tipo 52 (Guía Despacho), 34 (Factura Exenta) y el resto de tipos opcionales del Set de
      Pruebas de §5.0-5.11 — pendiente, ver brecha de implementación en §5.11 (no priorizado aún).
- [x] Recibido el Set de Pruebas oficial de Boleta Electrónica (§5.12) — **vigente, no obsoleto**.
      Corrección 2026-07-18: se pensó que el Set de Pruebas nuevo (§5.0) lo reemplazaba, pero el
      aviso del SII ("si obtiene un nuevo Set de Pruebas, éste reemplazará al actualmente vigente")
      aplica por tipo de documento — Boleta nunca se volvió a solicitar en esta ronda (no aparece
      en la tabla de "Sets Obtenidos" de §5.0, que es del proceso de certificación de Factura/
      NC-ND/Guía/Exenta/Exportación/Liquidación/Factura de Compra), así que su Set original (5
      casos) sigue siendo el vigente. Reconfirmado por correo del SII sobre Boleta que el usuario
      ya tenía de antes (recibido la noche previa a esta corrección, no es una respuesta nueva del
      SII a la ronda del Set de §5.0) — mismo procedimiento de 5 pasos ya documentado en §5.12.

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

**Primera emisión real de verdad — Boleta caso 1, 2026-07-19 (folio #1 del CAF 39 consumido,
`dte_documentos.id=1`, rechazado):** el envío automatizado (`enviarSetDte`) devolvió la misma
página HTML genérica de siempre, sin detalle. Se diagnosticó reenviando el mismo sobre firmado
manualmente por el portal web del SII ("Envío de DTE y libros de compras y ventas"), que sí da
detalle de schema — revelando **4 bugs reales** en `envioDte.js`, ninguno detectable por
`verify.js` porque nunca probaba ese archivo contra un validador de schema real:
1. `<FchResol>` faltaba en la Carátula (`dteService.js` nunca lo pasaba) — obligatorio incluso con
   `NroResol=0` (autorización por folios). **Arreglado**: `buildCaratula` ahora lanza si falta.
2. `<SubTotDTE>` usaba el tag `<TipoDTE>` en vez de `<TpoDTE>` (ese nombre solo es correcto dentro
   de `<IdDoc>` del propio DTE). **Arreglado**.
3. `<TmsFirmaEnv>` debía ser `<TmstFirmaEnv>` (typo, falta una "t"). **Arreglado**.
4. Cada DTE trae su propio prólogo `<?xml ...?>`, que quedaba anidado dentro de `<EnvioDTE>` —
   inválido (un `<?xml?>` solo puede ir al inicio absoluto de un documento). **Arreglado**:
   `buildYFirmarEnvioDte` ahora lo quita antes de insertar el documento en el sobre.

Además se corrigió `<RutEnvia>` (antes usaba el RUT de la empresa; ahora usa el RUT del **titular
del certificado** — pueden ser personas distintas, nueva `extraerRutCertificado()` en
`signXml.js`), aunque el validador de schema no lo marcó como error (es una validación semántica
del SII, no de schema, así que no se pudo confirmar/descartar por esta vía).

**Bloqueador nuevo, específico de Boleta:** con los 4 bugs arriba corregidos, el schema real
todavía rechaza `TipoDTE=39` dentro de `<EnvioDTE>` — la enumeración permitida es
`[33, 34, 43, 46, 52, 56, 61, 110, 111, 112]`, sin Boleta. **Boleta Electrónica requiere su propio
sobre `<EnvioBOLETA>`** (Formato Boletas Electrónicas v4.00), no implementado todavía — ver §5.12.

**Continuación 2026-07-19 — 2 bugs más de firma + reestructuración completa (folios #1 y #2 de
Factura consumidos y rechazados antes de resolver):**

5. **Transform incorrecto**: el schema real (`xmldsignature_v10.xsd`, obtenido y leído completo)
   confirma `maxOccurs=1` para `<Transform>` — pero el algoritmo correcto es **C14N, no
   enveloped-signature**. Se confirmó comparando byte a byte contra el "DTE de ejemplo" oficial
   del SII (`manual_certificacion.pdf` Anexo 5.1, un ejemplo con firma válida real): ahí
   `<Signature>` va como *hermano* de `<Documento>` (nunca anidado dentro), así que no hace falta
   "envelope-strip" — solo canonicalizar de verdad. `xml-crypto` solo aplica canonicalización real
   cuando el Transform declarado es un algoritmo de canonicalización; con enveloped-signature el
   digest se calculaba sobre una serialización cruda del DOM que nunca iba a coincidir con la
   verificación real. **Arreglado** en `signXml.js`.
6. **La causa de fondo real**: incluso con el Transform correcto, firmar un `<Documento>`/`<SetDTE>`
   mientras todavía está aislado (antes de insertarlo en su `<EnvioDTE>` final, que agrega
   `xmlns:xsi`/`xsi:schemaLocation` — **obligatorio**, confirmado con STATUS 7 "Invalid Schema
   Name" sin él) invalida la firma en cuanto ese ancestro agrega el namespace nuevo — afecta tanto
   el digest de la Referencia como el propio `<SignedInfo>`, con C14N normal o exclusivo por
   igual. No hay forma de firmar aislado y reinsertar después de forma segura si el contexto final
   agrega namespaces. **Solución real**: dejar de reinsertar — separar "armar" de "firmar" y
   firmar solo cuando el documento ya está en su posición final dentro del sobre completo:
   - `dteXml.js`: nuevo `buildDte()` arma el `<Documento>` SIN firmar. `buildYFirmarDte()` se
     mantiene como wrapper standalone (firma inmediata, para uso aislado) — ya no debe reinsertarse
     en otro documento después de firmado.
   - `envioDte.js`: nuevo `buildEnvioDteSinFirmar()` ensambla el sobre completo (con
     `xsi:schemaLocation` ya puesto) sin firmar nada. Nuevo `firmarEnvioDteEnSitio()` firma
     `Documento` y luego `SetDTE`, ya ensamblados en su posición final, usando el nuevo soporte de
     `location` en `signXml.js` (`signDocumento` acepta `location: {reference, action}` para
     insertar la `<Signature>` junto al elemento referenciado, no al final del documento raíz).
   - `dteService.js`: usa el nuevo flujo. `xml_firmado` ahora guarda el sobre `EnvioDTE` completo.
   - Nueva regresión en `verify.js` §9: verificación criptográfica **real** de ambas firmas del
     flujo completo de producción, con `xsi:schemaLocation` presente — 33/33 checks pasan.

**Resultado tras el fix (folio #4, 2026-07-19):** primera vez en toda la sesión que el envío
automatizado (`enviarSetDte`) fue **aceptado en la subida** (`"ok": true, "estadoSii": "enviado"`,
Track ID real) — el bug de Transform + firma en sitio quedó resuelto de punta a punta a nivel de
schema y subida. **Pero la validación final del SII sigue devolviendo "RFR - Rechazado por Error
en Firma"** al consultar el estado del envío, pese a que ambas firmas se verifican como
criptográficamente válidas incluso contra el certificado real (confirmado localmente, sin red).
Esto ya no parece ser un bug de código — hipótesis actual: el certificado usado (**Nicolás Gabriel
Machuca Carrasco, RUT 19169587-9, emitido por "Acepta.com Autoridad Certificadora Clase 3 Persona
Natural - G4"**) podría no estar acreditado específicamente para firma de DTE ante el SII (el
`.pfx` solo trae el certificado hoja, sin cadena — aunque el schema del SII de todos modos solo
permite un `<X509Certificate>` en `<X509Data>`, no una cadena, así que esto no parece ser
arreglable agregando más certificados). **Descartado parcialmente**: la página del producto del
certificado (Acepta.com) indica "Firma compatible con todas las soluciones de facturación" y
"listo para centralizar en el portal del SII" — el certificado en sí debería servir.

**Bug real #7 encontrado y arreglado (2026-07-19):** la Carátula mandaba `<NroResol>0</NroResol>`
+ la fecha del CAF, asumiendo "0 = autorización por folios" — pero **NATIVECODE SPA tiene una
Resolución real del SII: N°99, del 21-10-2014** (confirmado en "Actualización de datos empresa
autorizada" del portal). Arreglado: `dteService.js` ahora usa `DTE_NRO_RESOLUCION=99` /
`DTE_FCH_RESOLUCION=2014-10-21` (nuevas variables de entorno). **Probado con el folio #5 (el
último del CAF)**: subida aceptada de nuevo (STATUS=0, Track ID `0253167868`), pero **la
validación final del SII sigue devolviendo "RFR - Rechazado por Error en Firma"**.

**Estado al 2026-07-19, fin de la sesión de pruebas — los 5 folios de Factura del CAF están
agotados**, ninguno con aceptación final:

| Folio | Track ID | Resultado |
|---|---|---|
| 1 | — | Rechazado en la subida (bug Transform + namespace, antes de los fixes) |
| 2 | — | Rechazado en la subida (bug Transform, antes del fix C14N) |
| 3 | — | STATUS 7 "Invalid Schema Name" (antes de restaurar xsi:schemaLocation) |
| 4 | 0253167552 | Subida aceptada (STATUS 0) — **rechazo final: RFR Error en Firma** |
| 5 | 0253167868 | Subida aceptada (STATUS 0) — **rechazo final: RFR Error en Firma** |

Con 7 bugs reales de código encontrados y arreglados, la firma verificada criptográficamente
válida en repetidas pruebas locales contra el certificado real, y la subida aceptada dos veces —
el rechazo final "Error en Firma" ya no parecía un bug de código alcanzable por verificación
offline. Se mandó un mensaje a Mesa de Ayuda del SII con los Track ID `0253167552`/`0253167868`
(ver `~/Desktop/mensaje_mesa_ayuda_sii_dte.txt`), pero **se resolvió por investigación propia antes
de tener respuesta**, con 2 bugs reales más — ninguno era el certificado ni Acepta.com:

**Bug real #8 (2026-07-19) — usuario no registrado en el sistema de Facturación de **Mercado**:**
consultando directamente `QueryEstUp.jws` con el Track ID `0253167972` (folio de un CAF nuevo, ya
con la Resolución del bug #7 corregida) se obtuvo `ESTADO=106, GLOSA="Usuario sin permiso de
envio"` — un código que ni siquiera aparece en el manual oficial de 2004 de este servicio. Marcar
el RUT del certificado (19169587-9) en "Sistema de facturación **gratuito**" → "Mantención de
usuarios autorizados" no tuvo efecto (ese es un sistema distinto). La corrección real: **Servicios
Online → Factura electrónica → Menú Postulantes → Ambiente Certificación y Prueba →
"Actualización de Datos de empresa autorizada" → Mantención de usuarios** (sistema de
**Facturación de Mercado**, el que usa nuestro motor vía DTEWS) — ahí había que agregar/marcar el
RUT del certificado con los 4 permisos (Usuario Administrador, Firmar Documentos, **Enviar
Documentos**, Registro). Tras esto, el mismo tipo de consulta pasó de `106` a `RFR` (código
oficial) — confirmando que el permiso era real, pero quedaba el síntoma original.

**Bug real #9 (2026-07-19) — encoding declarado (ISO-8859-1) vs bytes realmente enviados
(UTF-8):** el sobre `<EnvioDTE>` declara `<?xml ... encoding="ISO-8859-1"?>`, pero
`siiClient.enviarSetDte` armaba el archivo con `new Blob([envioXmlFirmado])`, que **siempre**
codifica un string JS como UTF-8, sin importar el prólogo. Cualquier tilde/ñ en los datos (y
`emisor_comuna` de NATIVECODE SPA es literalmente `"ÑIQUÉN"`, además del detalle de prueba
"Cajón") queda mal decodificada por el SII si honra el encoding declarado ("Cajón" → "CajÃ³n"),
lo que corrompe el contenido que ve su lado y hace que su digest recalculado nunca coincida con
el nuestro — **esto explica el "Rechazado por Error en Firma" en absolutamente todos los intentos
anteriores**, ninguno de los cuales usó datos 100% ASCII. Arreglado en `siiClient.js`
(`xmlComoBytesIso88591()`, nueva función expuesta y con regresión en `verify.js` §10): se convierte
el string a un `Buffer` con encoding `'latin1'` real antes de envolverlo en el `Blob`, en vez de
dejar que `Blob` decida. **Confirmado con el folio #5 (el último del CAF), 2026-07-19: el estado
pasó de `RFR` a `RCT` ("Rechazado por Error en Carátula")** — un código totalmente distinto,
prueba de que la firma ya no es la causa del rechazo.

**Bug real #10 (2026-07-19) — `NroResol` debe ser 0 en Certificación, no la Resolución real:** el
"arreglo" del bug #7 (usar la Resolución N°99/2014 real de NATIVECODE SPA en vez de 0) era
**incorrecto para el ambiente de Certificación** — confirmado textualmente en el manual oficial del
SII ("MANUAL PARA EMPRESAS USUARIAS AMBIENTE DE CERTIFICACIÓN FACTURA ELECTRONICA"): *"Numero
Resolución: 0 (**Valor fijo en Ambiente de Certificación**)"*. La Resolución real de producción
todavía no aplica durante la certificación — el SII recién la reconoce cuando el postulante
aprueba todas las pruebas y declara cumplimiento. Esto es casi con certeza la causa del nuevo
`RCT`. **Arreglado** en `dteService.js`: `NroResol=0`/`FchResol=caf.fechaAutorizacion` siempre que
`ambiente==='certificacion'`; la Resolución real (`DTE_NRO_RESOLUCION`/`DTE_FCH_RESOLUCION`) solo
se usa si `ambiente==='produccion'`. **Sin probar contra el SII real todavía** — los 5 folios del
CAF de Factura están agotados; hace falta un CAF nuevo para confirmar.

**Estado al 2026-07-19, fin de esta ronda de pruebas:** con los bugs #8 y #9 confirmados en vivo
(evidencia dura: el estado real cambió de código en cada fix, `106 → RFR → RCT`, nunca fue una
suposición), y el bug #10 respaldado por una cita textual del manual oficial (pendiente de
confirmación real). **Siguiente paso**: pedir un CAF nuevo de Factura (33) y probar el fix del bug
#10 — con alta confianza de que sea el último bloqueador, dado que cada corrección real hasta
ahora ha cambiado el código de rechazo a uno más profundo en el pipeline de validación del SII
(firma → carátula), nunca ha vuelto a un código anterior.

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
se inserta el registro a mano (script desechable Tipo B, mismo patrón que `test_token_sii.js`).

**4 CAF cargados en producción (2026-07-19, certificación, folios 1-5 cada uno):** tipo 33
(Factura), 39 (Boleta), 56 (Nota de Débito), 61 (Nota de Crédito) — ids 1-4 en `dte_caf`, archivos
en `/root/finance/secrets/dte/caf/caf_{tipo}_cert_1-5.xml`, permisos 600. Confirmado `RE=78184828-K`,
`RS=NATIVECODE SPA`, `FA=2026-07-18` en los 4. Ventana de 24h corriendo desde esa fecha — usar los
folios pronto (Set de Boleta §5.12, casos NC/ND del SET BASICO §5.1).

---

## 5. Set de Pruebas SII

### 5.0 Vigente — Set de Certificación completo (recibido 2026-07-18)

> Este Set no incluye Boleta (Tipo 39) en absoluto — es enteramente Factura (33) + Nota de
> Crédito/Débito (61/56) + Guía de Despacho (52) + Factura Exenta (34) + Documentos de
> Exportación + Liquidación Factura + Factura de Compra (46). Emisor: **NATIVECODE SPA, RUT
> 78184828-K**.
>
> **Corrección 2026-07-18:** este Set **no reemplaza** al de Boleta Electrónica (§5.12) — son dos
> trámites de certificación independientes. La advertencia del SII sobre "un Set nuevo reemplaza
> al vigente" aplica solo si se vuelve a pedir Set **del mismo tipo de documento**; Boleta no se
> volvió a solicitar en esta ronda (no aparece en la tabla de "Sets Obtenidos" de abajo, que es
> del trámite de Factura/NC-ND/Guía/Exenta/Exportación/Liquidación/Factura de Compra), así que su
> Set original de 5 casos sigue vigente. Confirmado por correo propio del SII sobre Boleta,
> recibido el mismo día.

**Indicaciones generales del SII:**
- Adjuntar ejemplar tributario y cedible de: Factura Electrónica, Factura No Afecta o Exenta
  Electrónica, Guía de Despacho Electrónica y Factura de Compra Electrónica.
- Datos del contribuyente (giro, razón social, direcciones, sucursales, Dirección Regional o
  Unidad) se consultan en "Mi SII". No usar abreviaciones en los giros, ni agregar textos que
  informen arreglos de contrato con los clientes.
- Los descuentos por línea o globales deben indicarse en las representaciones impresas (PDF).
- Cifras con separador de miles usando `.`.

**Estado del set en el portal SII (snapshot 2026-07-18) — todos "POR REALIZAR":**

| Set | Estado |
|---|---|
| SET BASICO | Por realizar |
| SET GUIA DE DESPACHO | Por realizar |
| SET FACTURA EXENTA | Por realizar |
| LIBRO DE VENTAS | Por realizar |
| LIBRO DE COMPRAS | Por realizar |
| LIBRO DE GUIAS | Por realizar |
| SET DOCUMENTOS DE EXPORTACION | Por realizar |
| SET DOCUMENTOS DE EXPORTACION (2) | Por realizar |
| SET CASO GENERAL FACTURA COMPRA | Por realizar |
| SET LIQUIDACION FACTURA | Por realizar |

#### 5.1 SET BASICO — N° atención 4959502 (Factura Electrónica + NC/ND)

| Caso | Documento | Ítems | Notas |
|---|---|---|---|
| 1 | Factura Electrónica | Cajón AFECTO 146×2.237; Relleno AFECTO 62×3.695 | simple, sin descuento |
| 2 | Factura Electrónica | Pañuelo AFECTO 503×3.947 (desc. ítem 7%); ÍTEM 2 AFECTO 439×3.005 (desc. ítem 14%) | **descuento por línea** |
| 3 | Factura Electrónica | Pintura B&W AFECTO 38×4.594; ÍTEM 2 AFECTO 193×3.422; ÍTEM 3 SERVICIO EXENTO 1×35.005 | mixto afecto/exento |
| 4 | Factura Electrónica | ÍTEM 1 AFECTO 252×3.846; ÍTEM 2 AFECTO 107×4.373; ÍTEM 3 SERVICIO EXENTO 2×6.801 | + **descuento global 15% solo sobre ítems afectos** |
| 5 | Nota de Crédito Electrónica | Referencia: Factura del CASO-1 | Razón: "Corrige giro del receptor" (sin líneas de detalle) |
| 6 | Nota de Crédito Electrónica | Referencia: Factura del CASO-2 | Razón: "Devolución de mercaderías" — Pañuelo AFECTO 185; ÍTEM 2 AFECTO 297 (cantidades, sin precio — usa el de la factura referenciada) |
| 7 | Nota de Crédito Electrónica | Referencia: Factura del CASO-3 | Razón: "Anula factura" (anula completa) |
| 8 | Nota de Débito Electrónica | Referencia: NC del CASO-5 | Razón: "Anula Nota de Crédito Electrónica" |

#### 5.2 SET LIBRO DE VENTAS — N° atención 4959503

Construir el Libro de Ventas con los documentos generados en el SET BASICO (§5.1) — es un reporte
(IECV), no un DTE individual.

#### 5.3 SET LIBRO DE COMPRAS — N° atención 4959504

Documentos a registrar en el libro (no se emiten, son de terceros/recibidos):

| Tipo documento | Folio | Observación | Monto exento | Monto afecto |
|---|---|---|---|---|
| Factura | 234 | Factura del giro con derecho a crédito | — | 63.321 |
| Factura Electrónica | 32 | Factura del giro con derecho a crédito | 11.197 | 13.032 |
| Factura | 781 | Factura con IVA uso común (factor proporcionalidad **0,60**) | — | 30.292 |
| Nota de Crédito | 451 | NC por descuento a factura 234 | — | 2.994 |
| Factura Electrónica | 67 | Entrega gratuita del proveedor | — | 12.800 |
| Factura de Compra Electrónica | 9 | Compra con retención total del IVA | — | 10.965 |
| Nota de Crédito | 211 | NC por descuento factura electrónica 32 | — | 10.498 |

#### 5.4 SET GUIA DE DESPACHO — N° atención 4959505

> Señalar el tipo de traslado en todos los casos. Si el traslado es "Interno", receptor = emisor;
> al no constituir venta, el ejemplar cedible es inoficioso.

| Caso | Motivo | Traslado por | Ítems |
|---|---|---|---|
| 1 | Traslado de materiales entre bodegas de la empresa | — (interno) | ÍTEM 1 ×78; ÍTEM 2 ×122; ÍTEM 3 ×83 (sin precio) |
| 2 | Venta | Emisor del documento al local del cliente | ÍTEM 1 345×7.061; ÍTEM 2 666×1.621 |
| 3 | Venta | Cliente | ÍTEM 1 168×1.949; ÍTEM 2 412×5.519 |

#### 5.5 SET LIBRO DE GUIAS — N° atención 4959506

Construir con las guías del §5.4. El CASO 2 se facturó en el período; el CASO 3 fue anulado.

#### 5.6 SET FACTURA EXENTA — N° atención 4959507

> No informar el monto IVA 19% en Factura No Afecta o Exenta (solo monto Exento y Total).

| Caso | Documento | Ítems | Notas |
|---|---|---|---|
| 1 | Factura No Afecta o Exenta Electrónica | Horas Programador 3×2.745 (Hora) | — |
| 2 | Nota de Crédito Electrónica | Ref: Factura del CASO-1 | Razón: "Modifica monto" — Horas Programador → 343 |
| 3 | Factura No Afecta o Exenta Electrónica | Serv. Consultoría Fact. Electrónica 1×187.349; Serv. Consultoría Guía Despacho Elect. 1×198.897 | — |
| 4 | Nota de Crédito Electrónica | Ref: Factura del CASO-3 | Razón: "Corrige giro" |
| 5 | Nota de Débito Electrónica | Ref: NC del CASO-4 | Razón: "Anula Nota de Crédito Electrónica" |
| 6 | Factura No Afecta o Exenta Electrónica | Capacitación uso cigüeñales 1×276.206; Capacitación uso PLC's CNC 1×174.503 | — |
| 7 | Nota de Crédito Electrónica | Ref: Factura del CASO-6 | Razón: "Modifica monto" — Capacitación cigüeñales → 138.103 |
| 8 | Nota de Débito Electrónica | Ref: Factura del CASO-6 | Razón: "Modifica monto" — Capacitación PLC's CNC → 34.901 |

#### 5.7 SET DOCUMENTOS DE EXPORTACION (1) — N° atención 4959508

| Caso | Documento | Ítems | Datos de exportación |
|---|---|---|---|
| 1 | Factura de Exportación Electrónica | Chatarra de Aluminio 808×171 (LT) | Ref: MIC; moneda Libra Est.; sin pago; consignación con mínimo a firme; cláusula S/CL (total 4.248,06); vía marítima/fluvial/lacustre; Punta Arenas → Yokohama; tara PAR, peso bruto/neto LT; bultos: 81 rollos; flete 3.007,66; seguro 2.129,45; destino Japón |
| 2 | NC de Exportación Electrónica | Ref: Factura CASO-1 | Razón: "Devolución de mercadería" — Chatarra de Aluminio ×269 (mismo precio unitario de la factura) |
| 3 | ND de Exportación Electrónica | Ref: NC CASO-2 | Razón: "Anula nota de crédito" |

#### 5.8 SET DOCUMENTOS DE EXPORTACION (2) — N° atención 4959509

| Caso | Documento | Ítems | Datos de exportación |
|---|---|---|---|
| 1 | Factura de Exportación Electrónica | Asesorías y proyectos profesionales, valor línea 33 | Ref: Resolución SNA; moneda Euro; cobranza; cláusula CIF; carretero/terrestre; Caldera → Sidney; destino Australia; **recargo 10% en la línea por comisiones en el exterior** |
| 2 | Factura de Exportación Electrónica | Cajas ciruelas tiernizadas 428×133 (KN); cajas pasas uva 182×79 (KN) | Ref: DUS, AWB; moneda Euro; cobranza; venta bajo condición; cláusula CIF (total 1.966,49); carretero/terrestre; Caldera → Sidney; tara U, peso bruto/neto KN; bultos: 43 pallets; flete 644,52; seguro 211,24; destino Australia; **recargo global 11% del total cláusula; descuento línea #1: 5%** |
| 3 | Factura de Exportación Electrónica | Alojamiento habitaciones, valor línea 98 | Moneda Dólar USA; nacionalidad Australia |

Instrucciones: todos los documentos de exportación se asumen del mismo período tributario; asignar
folio autorizado y completar encabezado; **enviar en envíos separados** el Set (1) y el Set (2).
Flete/Seguro van en los campos informativos del encabezado **y** como dos líneas de recargo global.

#### 5.9 SET BASICO LIQUIDACIONES — N° atención 4959510

Liquidación Factura Electrónica, 4 casos con líneas Neto/Exento por documento referenciado
(facturas, boletas, NC, comisiones) — ver correo original para el detalle línea por línea si se
implementa; no transcrito aquí por ser el set con menor prioridad (opcional, sin código de
Liquidación construido todavía).

#### 5.10 SET CASO GENERAL EMISOR FACTURA DE COMPRA — N° atención 4959511

| Caso | Documento | Ítems | Notas |
|---|---|---|---|
| 1 | Factura de Compra Electrónica | Producto 1 1.088×8.250; Producto 2 41×4.591 | — |
| 2 | Nota de Crédito Electrónica | Ref: Factura de Compra CASO-1 | Razón: "Devolución de mercadería ítems 1 y 2" — Producto 1 ×363; Producto 2 ×14 (mismo precio unitario de la factura) |
| 3 | Nota de Débito Electrónica | Ref: NC CASO-2 | Razón: "Anula Nota de Crédito Electrónica" |

#### 5.11 Brecha con lo construido hoy (importante antes de tocar código)

| Falta construir | Necesario para | Estado |
|---|---|---|
| Descuento/recargo **por línea** | §5.1 caso 2, §5.8 caso 2 | [x] Ya existía (`descuentoMonto` por línea) |
| Descuento/recargo **global** | §5.1 caso 4, §5.8 casos 1 y 2 | [x] **Construido y verificado Tipo A** (`buildDscRcGlobal`, `verify.js` §8) — falta CAF real para Tipo B/C |
| **Nota de Crédito Electrónica (61)** con referencia a otro DTE | §5.1, §5.6, §5.7, §5.10 (la mayoría de los casos) | [x] **Construido y verificado Tipo A** (`buildReferencia`, `verify.js` §8) — falta CAF real para Tipo B/C |
| **Nota de Débito Electrónica (56)** con referencia | §5.1, §5.6, §5.7, §5.10 | [x] Mismo mecanismo que NC (61), motor es genérico por `tipoDte` |
| **Guía de Despacho Electrónica (52)** (con tipo de traslado) | §5.4 | [ ] Pendiente — próxima pasada |
| **Factura No Afecta o Exenta Electrónica (34)** (sin IVA en el XML) | §5.6 | [ ] Sin cambios de motor necesarios (usa `computeMontosFactura` con todas las líneas `indExe:1`) — falta probar el caso puntual |
| **Factura de Exportación Electrónica (110)** + NC/ND Exportación (111/112) + bloque `Aduana` | §5.7, §5.8 | [ ] Pendiente — próxima pasada |
| **Liquidación Factura Electrónica (43)** | §5.9 (opcional) | [ ] Pendiente — próxima pasada |
| **Factura de Compra Electrónica (46)** | §5.10 (opcional) | [ ] Pendiente — próxima pasada |
| Libro de Ventas / Compras / Guías (IECV) | §5.2, §5.3, §5.5 — sistema distinto al de emisión DTE, no evaluado aún | [ ] Sin evaluar |

**Estado 2026-07-18:** el usuario priorizó explícitamente Factura Electrónica + Boleta ("lo
importante por ahora es factura electrónica y boletas") — se implementó descuento global +
Referencia (NC/ND) en `dteXml.js`, verificado offline (Tipo A, `verify.js` §8, 10/10 checks OK,
cero regresión en las 7 secciones anteriores). Boleta (`computeMontosBoleta`) no se tocó. Todavía
sin tocar `dteService.js`/`DteController.js`/rutas/frontend — eso espera CAF real (61/56/33) y una
decisión de UI para elegir documento a referenciar + motivo, que hoy no existe en el modal "Emitir
Documento Tributario".

Para este Set (§5.0-5.11) los CAF a solicitar ya no son solo 33: se necesitan además **61, 56, 52,
34** como mínimo para el SET BASICO + FACTURA EXENTA + GUÍA DE DESPACHO, y **46, 110/111/112, 43**
si se aborda también Factura de Compra / Exportación / Liquidación — todo esto aparte del CAF 39
(Boleta), que sigue su propio trámite independiente (§5.12).

#### 5.12 VIGENTE — Set de Boleta Electrónica (track de certificación independiente)

> Documento oficial del SII, "SET DE PRUEBA DE BOLETA ELECTRÓNICA DE VENTAS Y SERVICIOS". **Sigue
> vigente** — no lo reemplazó el Set de §5.0 (ver corrección 2026-07-18 en §0 y §5.0: son dos
> trámites de certificación distintos, Boleta nunca se volvió a solicitar). Confirmado por correo
> propio del SII sobre Boleta (procedimiento de 5 pasos, CAF de 5 folios, ventana de 24h — ver
> §0/Fase 0). Requiere su propio CAF Tipo 39, independiente de los CAF de §5.0.

> **BLOQUEADOR encontrado 2026-07-19 (primera prueba real, ver §4.1):** Boleta necesita su propio
> sobre de envío (`<EnvioBOLETA>`), **no** `<EnvioDTE>`. El validador de schema real del SII
> rechaza explícitamente `TipoDTE=39` dentro de `<EnvioDTE>` ("cvc-enumeration-valid... enumeration
> [33, 34, 43, 46, 52, 56, 61, 110, 111, 112]" — 39 no está). Esto es consistente con que el propio
> correo de Boleta dirige a informar el Track ID en un **"apartado de Boletas electrónicas"**
> separado del de Factura Electrónica. `envioDte.js` hoy solo construye `<EnvioDTE>` — **falta
> construir el sobre `<EnvioBOLETA>`** (Formato Boletas Electrónicas v4.00) antes de poder emitir
> boletas reales contra el SII. Motor de firma/TED de la Boleta en sí (`dteXml.js`) no se ve
> afectado — el problema es solo el sobre de envío.

| Caso | Ítems | Nota |
|---|---|---|
| 1 | Cambio de aceite 1×19.900; Alineación y balanceo 1×9.900 | — |
| 2 | Papel de regalo 17×120 | — |
| 3 | Sandwich 2×1.500; Bebida 2×550 | — |
| 4 | Ítem afecto 1 8×1.590; Ítem exento 2 2×1.000 | `indExe: 1` en la línea exenta |
| 5 | Arroz 5×700 | `unidadMedida: 'Kg'` |

---

## 6. Checklist de implementación (actualizado)

### Fase 0 — Requisitos
- [x] Certificado digital
- [x] Registro como emisor DTE
- [x] **CAF Tipo 39 (boletas) — solicitado, descargado y cargado** (2026-07-19, 5 folios,
      certificación).
- [x] **CAF Tipo 33 (facturas), 61 (NC) y 56 (ND) — solicitados, descargados y cargados**
      (2026-07-19, 5 folios cada uno, certificación).
- [ ] CAF Tipo 52/34 (Guía Despacho/Factura Exenta) y el resto de tipos opcionales — no priorizado.
- [x] Guardar archivos `.pfx` y CAF en lugar seguro (VPS, fuera de git, permisos 600) — ver §4.4.

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
- [x] Descargar CAF Tipo 39/33/61/56 (5 folios c/u) — ventana de 24h corriendo desde 2026-07-19
- [x] Insertar los 4 CAF en `dte_caf` (§4.4) — ids 1-4
- [ ] Prueba Tipo B (script desechable) con CAF real antes de gastar folios en los casos reales —
      nunca se ha confirmado un `enviarSetDte` aceptado de verdad (solo el rechazo esperado con
      CAF sintético, §2.7/§4.1)
- [ ] Generar y enviar el Set de Boleta (§5.12, 5 casos) + RCOF
- [ ] Generar y enviar los 8 casos del SET BASICO (§5.1, Factura+NC+ND) — requiere script
      desechable que llame `buildYFirmarDte`/`siiClient` directo con `referencias`/
      `descuentosGlobales`, ya que `dteService.emitirDte` todavía no los soporta (ver más abajo)
- [ ] Reportar track ID de cada envío, obtener V°B°, Declaración de Cumplimiento (por separado
      para Boleta y para el SET BASICO — son certificaciones independientes)
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

*Documento actualizado tras recibir el nuevo Set de Pruebas oficial del SII (2026-07-18, §5),
que reemplaza al de Boleta Electrónica y amplía el alcance a Factura + NC/ND + Guía de Despacho +
Factura Exenta + Documentos de Exportación + Liquidación + Factura de Compra. Próximo paso:
decidir qué sub-set abordar primero y cerrar la brecha de implementación (§5.11) antes de pedir
los CAF correspondientes.*
