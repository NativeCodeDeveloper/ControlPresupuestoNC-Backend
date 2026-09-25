# Health Score — guía de implementación

> **Reparto:** Dan trabaja en Agenda Clínica (backend y después front). Claude trabaja en Finance.
> **Piloto:** el entorno de desarrollo — front `desarrollo.agendaclinicas.cl`,
> backend `back.desarrollo.agendaclinicas.cl`.
> **Contrato de la API:** ver `agenda-clinica-health-metrics.md`.

---

## Lo que hay que entender antes de escribir código

Finance ya está construido: el cron, la caché, la UI y el cálculo del score. Llama todos los días
a `GET {ruta_backend}/health-metrics` y espera cinco números. Ese endpoint no existe, por eso el
log de producción repite `Agenda Clínica respondió 404`.

**El hallazgo que define el diseño:** la base de Agenda Clínica **no guarda cuándo se creó** una
reserva ni una ficha. Lo verifiqué consultando `AGENDA_CLINICA_DESARROLLO`: `reservaPacientes`
tiene 24 columnas y ninguna es fecha de creación; `fichaClinica` solo tiene `fechaConsulta`, que
la escribe el profesional a mano y es editable.

Agregar esas columnas obligaba a migrar 49 bases de clientes. **Se descartó.** En su lugar:

> Agenda Clínica devuelve **totales acumulados** (`COUNT(*)` simple), y **Finance guarda ese total
> cada día**. La actividad sale de la resta: `reservas(hoy) − reservas(hace 30 días)`.

Eso deja el trabajo en Agenda Clínica reducido a consultas triviales.

**Lo único que sí hay que crear en su base** es el registro de accesos, porque `diasSinActividad`
—el 35% del score— no tiene de dónde salir: no existe ninguna tabla de usuarios, sesiones o
accesos en las 41 tablas de la base, y el backend no tiene login (Clerk vive solo en el front).

Ese registro además cubre lo que la ley de protección de datos exige: fecha, hora y quién accedió.

---

## Reparto de las 5 métricas

| # | Métrica | Peso | Quién la calcula | Qué devuelve Agenda Clínica |
|---|---|---|---|---|
| 1 | `diasSinActividad` | 35% | Agenda Clínica | días desde el último acceso registrado |
| 2 | `tendenciaSemanal` | 25% | **Finance** | `null` — no la implementes |
| 3 | `reservas` | 15% | Finance deriva | `COUNT(*)` **acumulado total** |
| 4 | `confirmaciones` | 15% | Agenda Clínica | % de asistencia de los últimos 30 días |
| 5 | `fichasClinicas` | 10% | Finance deriva | `COUNT(*)` **acumulado total** |

La 4 sí se puede acotar a 30 días sin columnas nuevas, porque `fechaInicio` (la fecha de la cita)
ya existe como columna real.

---

## PASO 1 — Migración en Agenda Clínica

> ### ⚠️ BASE DE DATOS: `AGENDA_CLINICA_DESARROLLO`
>
> **Selecciónala en el panel izquierdo de phpMyAdmin ANTES de pegar el SQL.** Si vienes de correr
> algo en `finance_db`, phpMyAdmin conserva esa selección y la tabla cae en la base equivocada.
>
> Las dos tablas de este proyecto van en bases distintas y es el error fácil de cometer:
> `registro_accesos` la lee el backend de Agenda Clínica → va en la base de Agenda Clínica.
> `health_score_uso_serie` la escribe el cron de Finance → va en `finance_db`.

Una sola tabla. Archivo nuevo `migration_registro_accesos.sql`:

```sql
-- ============================================================
-- EJECUTAR EN: la base de datos de Agenda Clínica del cliente
--              (en desarrollo: AGENDA_CLINICA_DESARROLLO)
--              NO en finance_db.
--
-- Registro de accesos a la plataforma.
--
-- Doble propósito:
--   1. Health Score: es la única fuente posible de "días sin
--      actividad", la métrica que más pesa (35%).
--   2. Protección de datos: fecha, hora y quién accedió es lo
--      que se exige para certificar el tratamiento de datos
--      sensibles de salud.
--
-- Tabla y no columna "ultimo_acceso": guardar cada acceso
-- permite después responder "cuántos días de los últimos 30
-- hubo actividad", no solo "cuándo fue la última vez". Cuesta
-- lo mismo escribirla y no se puede recuperar el histórico
-- después si se elige mal ahora.
--
-- Aditiva: tabla nueva, no toca nada existente.
-- ============================================================
CREATE TABLE IF NOT EXISTS registro_accesos (
    id_acceso        BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_clerk_id VARCHAR(191) NULL COMMENT 'Identidad verificada contra Clerk',
    usuario_email    VARCHAR(255) NULL,
    usuario_nombre   VARCHAR(255) NULL,
    rol              VARCHAR(60)  NULL COMMENT 'Ver dashboard-access.js del front',
    id_profesional   INT          NULL COMMENT 'publicMetadata.idProfesionalAgenda',
    ip               VARCHAR(45)  NULL,
    user_agent       VARCHAR(255) NULL,
    ocurrido_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_acceso),
    KEY idx_accesos_ocurrido_en (ocurrido_en),
    KEY idx_accesos_usuario (usuario_clerk_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Comprueba que cayó donde corresponde — este SELECT te dice en qué base quedó:

```sql
SELECT TABLE_SCHEMA FROM information_schema.TABLES WHERE TABLE_NAME = 'registro_accesos';
```

Tiene que decir la base de Agenda Clínica. Si dice `finance_db`, se cruzó: bórrala de ahí con
`DROP TABLE finance_db.registro_accesos;` (está vacía, no se pierde nada) y vuelve a correrla con
la base correcta seleccionada.

---

## PASO 2 — Verificar el token de Clerk

**Por qué esto importa:** si el backend confía en lo que le manda el navegador, cualquiera puede
escribir con `curl` que entró el Dr. Pérez a las 3 AM. Para el health score daría igual; para
certificarse, un registro falsificable no vale nada.

**Verificado en producción:** cada cliente tiene **su propia instancia de Clerk**
(`clerk.3072.agendaclinicas.cl`, `clerk.glowsister.agendaclinicas.cl`, llaves distintas). Así que
la llave de verificación va en el `.env` de cada backend — es la misma que ya le pasas a Vercel
cuando creas el proyecto.

```bash
npm install @clerk/backend
```

`middleware/verificarUsuarioClerk.js`:

```js
import { verifyToken } from '@clerk/backend';

/**
 * Valida el token de sesión de Clerk que manda el front.
 *
 * No monta sesiones ni middleware global: solo verifica la firma del token
 * contra la instancia de Clerk de ESTE cliente y deja los datos del usuario
 * en req.usuario. Si el token no sirve, deja req.usuario en null y deja pasar
 * igual — este middleware protege la CALIDAD del registro de accesos, no el
 * acceso a la ruta. Un latido sin identidad sigue sirviendo como señal de
 * actividad; simplemente no se puede atribuir a nadie.
 */
export const verificarUsuarioClerk = async (req, res, next) => {
    req.usuario = null;
    try {
        const cabecera = req.headers.authorization || '';
        const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;
        if (!token || !process.env.CLERK_SECRET_KEY) return next();

        const datos = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });

        req.usuario = {
            clerkId: datos.sub,
            email: datos.email || null,
            nombre: datos.name || null,
            rol: datos.metadata?.role || datos.publicMetadata?.role || null,
            idProfesional: datos.publicMetadata?.idProfesionalAgenda || null,
        };
    } catch (error) {
        // Token vencido o inválido: no es un error de la app, se ignora.
        console.error('[CLERK] token no verificado:', error.message);
    }
    next();
};
```

> Revisa qué trae exactamente el token de tu instancia — los nombres de los claims
> (`publicMetadata`, `metadata`) dependen de cómo tengas configurada la plantilla de sesión en
> Clerk. Imprime `datos` una vez y ajusta el mapeo.

---

## PASO 3 — Middleware de API key

Para el endpoint que consume Finance. `middleware/verificarApiKey.js`:

```js
/**
 * Valida la API key de las llamadas máquina-a-máquina (NativeCode Finance).
 *
 * Acepta Authorization: Bearer <key>, que es lo que Finance ya envía y está
 * en producción. También acepta x-api-key, que es el formato que usan los dos
 * endpoints que ya existen en app.js.
 *
 * Falla cerrado: sin variable configurada no atiende a nadie. Es a propósito —
 * un backend sin la key puesta NO debe quedar abierto.
 */
export const verificarApiKey = (req, res, next) => {
    const claveEsperada = process.env.HEALTH_METRICS_API_KEY;
    if (!claveEsperada) {
        return res.status(503).json({ message: "apiKeyNoConfigurada" });
    }

    const cabecera = req.headers.authorization || '';
    const claveBearer = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;
    const claveRecibida = claveBearer || req.headers['x-api-key'];

    if (!claveRecibida || claveRecibida !== claveEsperada) {
        return res.status(401).json({ message: "noAutorizado" });
    }
    next();
};
```

---

## PASO 4 — El controlador

`controller/HealthMetricsController.js`. Consulta la base directamente sin pasar por `model/`,
igual que hace `NotificacionesPushController.js`: no son entidades CRUD, son agregaciones.

```js
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// estadoPeticion = 0 son reservas que expiraron sin pagar; el cron las marca
// así y la app no las muestra. Contarlas haría parecer más activa a una
// clínica con muchos abandonos de pago.
const SOLO_VISIBLES = 'estadoPeticion <> 0';

export default class HealthMetricsController {
    constructor() {}

    // FUNCION QUE ENTREGA LAS METRICAS DE USO A NATIVECODE FINANCE
    static async obtenerMetricas(req, res) {
        try {
            const [diasSinActividad, reservas, confirmaciones, fichasClinicas] =
                await Promise.all([
                    calcularDiasSinActividad(),
                    contarReservas(),
                    calcularConfirmaciones(),
                    contarFichas(),
                ]);

            res.status(200).json({
                diasSinActividad,
                tendenciaSemanal: null, // la calcula Finance desde su serie diaria
                reservas,
                confirmaciones,
                fichasClinicas,
            });
        } catch (error) {
            console.error('[HEALTH METRICS]', error.message);
            res.status(500).json({ message: "serverError" });
        }
    }

    // FUNCION PARA REGISTRAR QUE ALGUIEN INGRESO A LA PLATAFORMA
    static async registrarAcceso(req, res) {
        try {
            const u = req.usuario; // lo deja verificarUsuarioClerk, puede ser null

            // Un registro por usuario por hora: suficiente para "días sin
            // actividad" y evita que un F5 nervioso o una pestaña abierta
            // inflen la tabla con miles de filas por día.
            const recientes = await db().ejecutarQuery(`
                SELECT 1 FROM registro_accesos
                 WHERE ocurrido_en >= NOW() - INTERVAL 1 HOUR
                   AND (usuario_clerk_id = ? OR (usuario_clerk_id IS NULL AND ? IS NULL))
                 LIMIT 1
            `, [u?.clerkId || null, u?.clerkId || null]);

            if (recientes.length === 0) {
                await db().ejecutarQuery(`
                    INSERT INTO registro_accesos
                        (usuario_clerk_id, usuario_email, usuario_nombre, rol,
                         id_profesional, ip, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    u?.clerkId || null,
                    u?.email || null,
                    u?.nombre || null,
                    u?.rol || null,
                    u?.idProfesional || null,
                    req.ip || null,
                    String(req.headers['user-agent'] || '').slice(0, 255),
                ]);
            }

            res.status(200).json({ message: true });
        } catch (error) {
            console.error('[HEALTH METRICS] acceso:', error.message);
            // Nunca romper la app del cliente por telemetría: responde 200 igual.
            res.status(200).json({ message: true });
        }
    }
}

/**
 * Métrica 1 — la más importante (35% del score).
 * Días desde el último ingreso registrado. Devuelve null si nunca se registró
 * ninguno: null y 0 son distintos, y Finance los distingue para no marcar como
 * crítico a un cliente que simplemente no se pudo medir.
 */
async function calcularDiasSinActividad() {
    const filas = await db().ejecutarQuery(
        `SELECT DATEDIFF(NOW(), MAX(ocurrido_en)) AS dias FROM registro_accesos`, []
    );
    const dias = filas?.[0]?.dias;
    return dias === null || dias === undefined ? null : Number(dias);
}

/**
 * Métrica 3 — total acumulado de reservas. Finance guarda este número cada día
 * y saca la actividad de los últimos 30 días restando. Por eso acá NO se filtra
 * por fecha: mandar el acumulado completo es justo lo que se necesita.
 */
async function contarReservas() {
    const filas = await db().ejecutarQuery(
        `SELECT COUNT(*) AS total FROM reservaPacientes WHERE ${SOLO_VISIBLES}`, []
    );
    return Number(filas?.[0]?.total || 0);
}

/**
 * Métrica 4 — % de asistencia real de los últimos 30 días.
 *
 * Esta sí se acota por fecha sin columnas nuevas, porque fechaInicio (la fecha
 * de la CITA) ya existe. Solo cuentan citas que YA OCURRIERON: una reserva para
 * la semana que viene sigue en 'reservada' y contarla hundiría el porcentaje.
 *
 * Estados reales en la base: reservada, confirmada, anulada, no asiste, asiste.
 * La columna es texto libre sin validación, por eso se compara con LOWER/TRIM.
 */
async function calcularConfirmaciones() {
    const filas = await db().ejecutarQuery(`
        SELECT COUNT(*) AS total,
               SUM(LOWER(TRIM(estadoReserva)) = 'asiste') AS asistieron
          FROM reservaPacientes
         WHERE ${SOLO_VISIBLES}
           AND fechaInicio >= CURDATE() - INTERVAL 30 DAY
           AND fechaInicio <  CURDATE()
           AND LOWER(TRIM(estadoReserva)) <> 'anulada'
    `, []);

    const total = Number(filas?.[0]?.total || 0);
    if (total === 0) return null; // sin citas pasadas no hay porcentaje que calcular
    return Math.round((Number(filas[0].asistieron || 0) / total) * 100);
}

/**
 * Métrica 5 — total acumulado de fichas clínicas. Mismo criterio que reservas:
 * Finance deriva la ventana de 30 días desde su serie.
 * No se usa fechaConsulta porque la escribe el profesional a mano y es editable.
 */
async function contarFichas() {
    const filas = await db().ejecutarQuery(
        `SELECT COUNT(*) AS total FROM fichaClinica WHERE estadoFicha <> 0`, []
    );
    return Number(filas?.[0]?.total || 0);
}
```

---

## PASO 5 — Ruta y registro en `app.js`

`view/healthMetricsRoutes.js`:

```js
import { Router } from 'express';
import { verificarApiKey } from '../middleware/verificarApiKey.js';
import { verificarUsuarioClerk } from '../middleware/verificarUsuarioClerk.js';
import HealthMetricsController from '../controller/HealthMetricsController.js';

const router = Router();

// Lo llama el cron diario de NativeCode Finance. Protegido con API key.
router.get('/', verificarApiKey, HealthMetricsController.obtenerMetricas);

// Lo llama el navegador del profesional al entrar al dashboard.
// NO lleva API key (esa es de Finance); lleva el token de Clerk para saber quién es.
router.post('/acceso', verificarUsuarioClerk, HealthMetricsController.registrarAcceso);

export default router;
```

En `app.js`, el import arriba con los demás y el `app.use` en el bloque de rutas:

```js
import healthMetricsRoutes from "./view/healthMetricsRoutes.js";
// ...
app.use("/health-metrics", healthMetricsRoutes);
```

---

## PASO 6 — Variables de entorno

En el `.env` de cada instancia:

```
HEALTH_METRICS_API_KEY=<la key que genera Finance para este cliente>
CLERK_SECRET_KEY=<la misma que ya está en Vercel para este cliente>
```

**La API key la genera Finance, no la escribas a mano.** En *Production Cockpit → Backserver*,
al crear o editar el servidor del cliente, el campo API Key tiene un botón **Generar**: produce 64
caracteres aleatorios y te deja copiarlos de una. Ese mismo valor va en el `HEALTH_METRICS_API_KEY`
del `.env` de ese cliente.

Queda visible solo en ese momento — Finance nunca vuelve a mostrar una key guardada, porque se
almacena cifrada. Si la pierdes, generas otra y actualizas el `.env`.

**Una key distinta por cliente.** Si usas la misma para los 49 y se filtra una, quedan expuestas
todas. No reutilices `TEST_API_KEY` ni la `CLERK_SECRET_KEY`: esta última da acceso a administrar
los usuarios de esa instancia de Clerk, y no tiene por qué vivir también en Finance.

---

## PASO 7 — El latido desde el front

En `FRONTEND-UNIVERSAL-DESARROLLO-AC`, en el layout del dashboard o donde ya uses `useUser()`:

```js
const { getToken } = useAuth();

useEffect(() => {
    // Telemetría del health score + registro de acceso para protección de datos.
    // Si falla se ignora en silencio: el cliente NUNCA debe ver un error por esto.
    (async () => {
        try {
            const token = await getToken();
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health-metrics/acceso`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
        } catch { /* silencio a propósito */ }
    })();
}, []);
```

---

## PASO 8 — Pruebas

`PruebasUnitarias/HealthMetrics.http`:

```http
### 1. Sin key -> 401
GET http://localhost:3001/health-metrics

### 2. Key correcta -> 200 con los 5 campos
GET http://localhost:3001/health-metrics
Authorization: Bearer {{apiKey}}

### 3. Registrar acceso sin token -> 200 (queda sin identidad, pero cuenta)
POST http://localhost:3001/health-metrics/acceso

### 4. Registrar acceso con token de Clerk -> 200 (queda con nombre y correo)
POST http://localhost:3001/health-metrics/acceso
Authorization: Bearer {{tokenClerk}}
```

Después del caso 4, comprueba en la base:
`SELECT * FROM registro_accesos ORDER BY id_acceso DESC LIMIT 5;`

---

## Lo que hace Finance (ya escrito, para tu contexto)

- Migración `sql/2026-09-25_health_score_uso_serie.sql`: tabla que guarda el acumulado de cada
  cliente cada día.
- `healthScoreService.js`: el cron archiva el punto del día y deriva de la serie las ventanas de
  30 días y la tendencia semanal.
- **Durante los primeros días las métricas 2, 3 y 5 van a llegar en `null`**: la serie necesita 14
  días para la tendencia y 30 para las ventanas. Es correcto, no es un fallo.

---

## Anexo — qué NO hacer

**No filtres por `id_profesional`.** Los números son del centro completo. Cada cliente tiene su
propia base, así que "sin filtro" ya significa "toda la clínica".

**No devuelvas `0` cuando no puedas calcular algo.** Finance distingue `null` de `0`: un `0` falso
marca a un cliente como crítico sin motivo.

**No implementes `tendenciaSemanal`.** Sale de la serie de Finance.

**No olvides `estadoPeticion <> 0`.** Sin ese filtro cuentas reservas expiradas que la app ni
siquiera muestra.

**No registres el `ruta_backend` apuntando al front.** En Finance va
`https://back.desarrollo.agendaclinicas.cl`, sin barra final. El front devolvería su propio 404.
