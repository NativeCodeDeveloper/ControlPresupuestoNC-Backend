# Backend desde Cero — Guía de Estudio
### Basada en el backend de NativeCode Finance (Express + MySQL)
**Tutor:** Claude · **Estudiante:** Dan · **Meta:** 4 días × 2 horas

---

## Antes de empezar — La mentalidad correcta

Un backend es un **sistema de reglas** que decide:
- Quién puede acceder a qué dato
- Cómo se valida lo que llega
- Cómo se guarda de forma segura
- Qué pasa cuando algo falla

Tu trabajo como backend developer no es hacer que "funcione". Es hacer que funcione **correctamente, de forma segura, y sin sorpresas**.

---

# DÍA 1 — Arquitectura y el Servidor

## 1.1 ¿Qué es la arquitectura MVC?

MVC separa el código en tres capas con responsabilidades distintas. En este proyecto:

```
HTTP Request
    │
    ▼
app.js          ← Punto de entrada. Arma el servidor, carga middlewares, registra rutas.
    │
    ▼
view/           ← Las RUTAS. Define qué URL hace qué, y qué middleware protege qué.
    │
    ▼
controller/     ← El CONTROLADOR. Recibe la request, valida, llama al modelo o servicio.
    │
    ▼
model/          ← El MODELO. Habla con la base de datos. Solo SQL aquí.
    │
    ▼
MySQL           ← La base de datos.
```

**Regla de oro:** cada capa solo le habla a la capa inmediatamente debajo.
Un controlador no escribe SQL. Un modelo no responde HTTP. Un router no tiene lógica de negocio.

---

## 1.2 El punto de entrada: app.js

`app.js` es donde todo empieza. Tiene tres responsabilidades:

### a) Registrar middlewares globales (aplican a TODAS las rutas)

```js
// control-back/app.js
app.use(helmet());                          // Seguridad HTTP
app.use(rateLimit({ windowMs: 60_000, max: 500 })); // Limita 500 req/min por IP
app.use(morgan("combined"));               // Logs de cada request
app.use(express.json({ limit: "15mb" }));  // Parsear JSON del body
app.use(cors(corsConfig));                 // Control de orígenes permitidos
app.use(clerkMiddleware());                // Inyecta info de auth en req
```

**Orden importa.** Los middlewares se ejecutan en el orden en que los registras.
Si pones `express.json()` después de tu ruta, el body llega vacío.

### b) Registrar rutas

```js
app.use('/api/calendario',  requireAuth, calendarioRoutes);
app.use('/api/proyectos',    requireAuth, proyectosRoutes);
app.use('/api/finanzas',     requireAuth, finanzasRoutes);
```

`requireAuth` es un middleware que va entre la URL y el router.
Si el usuario no está autenticado, corta ahí y retorna 401. Nunca llega al router.

### c) Arrancar el servidor

```js
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
```

---

## 1.3 ¿Qué es un middleware?

Un middleware es una función con tres parámetros: `(req, res, next)`.

```js
function miMiddleware(req, res, next) {
    // Hacer algo con la request
    console.log('Alguien hizo una request a:', req.path);

    // Pasar al siguiente middleware o ruta
    next();

    // O cortar aquí y responder directamente
    // res.status(401).json({ error: 'No autorizado' });
}
```

Si llamas `next()` → continúa. Si no llamas `next()` → la request se queda colgada.

**Ejemplo real — `requireAuth.js`:**

```js
// control-back/middleware/requireAuth.js
import { getAuth } from '@clerk/express';

export const requireAuth = (req, res, next) => {
    const { userId } = getAuth(req);   // Lee el JWT de Clerk
    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    next(); // Token válido → continuar a la ruta
};
```

Tres líneas. No hace más de lo que debe. Si no hay userId, corta. Si lo hay, sigue.

---

## 1.4 Variables de entorno (.env)

**Nunca** pongas contraseñas, API keys o URLs sensibles en el código.

```bash
# .env (nunca se sube a GitHub)
DB_HOST=localhost
DB_USER=root
DB_PASS=mi_contraseña_secreta
DB_DATABASE=finance_db
VAPID_PUBLIC_KEY=BFj...
BILLING_REMINDER_TO=equipo@nativecode.cl
```

En código:
```js
const host = process.env.DB_HOST;  // Lee la variable de entorno
```

Si `DB_HOST` no existe, `process.env.DB_HOST` es `undefined`. Por eso siempre valida
las variables críticas al arrancar el servidor, no cuando las usas.

---

# DÍA 2 — Rutas y Controladores

## 2.1 Diseño RESTful

REST es una convención para nombrar URLs. La idea: la URL identifica el **recurso**, el verbo HTTP define la **acción**.

| Verbo  | URL                     | Qué hace                    |
|--------|-------------------------|-----------------------------|
| GET    | `/api/proyectos`        | Listar todos                |
| GET    | `/api/proyectos/5`      | Obtener uno por ID          |
| POST   | `/api/proyectos`        | Crear uno nuevo             |
| PUT    | `/api/proyectos/5`      | Actualizar completo         |
| PATCH  | `/api/proyectos/5`      | Actualizar parcial          |
| DELETE | `/api/proyectos/5`      | Eliminar                    |

**Mal diseño (no hagas esto):**
```
GET /getProyecto?id=5
POST /crearProyecto
POST /eliminarProyecto?id=5   ← POST para eliminar = incorrecto
```

**Buen diseño:**
```
GET    /api/proyectos/5
POST   /api/proyectos
DELETE /api/proyectos/5
```

---

## 2.2 El archivo de rutas (view/)

El router de Express define qué método + URL ejecuta qué función del controlador.

**Ejemplo real — `calendarioRoutes.js`:**

```js
import { Router } from 'express';
import CalendarioController from '../controller/CalendarioController.js';

const router = Router();

// Validación de ID antes de procesar cualquier ruta que use :id
const numericId = (req, res, next, val) =>
    /^\d+$/.test(val) ? next() : res.status(400).json({ error: 'ID inválido' });
router.param('id', numericId);

// CRUD básico
router.get('/',        CalendarioController.list);
router.post('/',       CalendarioController.create);
router.put('/:id',     CalendarioController.update);
router.delete('/:id',  CalendarioController.remove);

// Rutas específicas ANTES de la ruta genérica /:id
router.get('/notificaciones/pendientes',  CalendarioController.getNotificaciones);
router.get('/:id',                        CalendarioController.get);

export default router;
```

**Regla crítica de orden:** Las rutas específicas van ANTES de las genéricas.
Si pones `router.get('/:id', ...)` antes de `router.get('/notificaciones/pendientes', ...)`,
Express interpreta `notificaciones` como un `id` y llama al handler equivocado.

**`router.param('id', handler)`** — se ejecuta automáticamente antes de cualquier ruta
que use `:id`. Ideal para validación centralizada.

---

## 2.3 El controlador

El controlador tiene una sola responsabilidad: **recibir la request y devolver una response**.

Estructura estándar de un método de controlador:

```js
static async crear(req, res) {
    try {
        // 1. Extraer y normalizar datos del body/params/query
        const { nombre, monto } = req.body;

        // 2. Validar que los datos requeridos existen y tienen sentido
        if (!nombre || !monto) {
            return res.status(400).json({ message: 'nombre y monto son requeridos' });
        }
        if (isNaN(monto) || monto <= 0) {
            return res.status(400).json({ message: 'monto debe ser un número positivo' });
        }

        // 3. Llamar al modelo o servicio
        const resultado = await MiModelo.insertar(nombre, Number(monto));

        // 4. Responder con el status correcto
        return res.status(201).json({ ok: true, id: resultado.insertId });

    } catch (error) {
        console.error('[MiController.crear]', error);
        return res.status(500).json({ message: 'Error al crear el recurso' });
    }
}
```

### Los `return` son obligatorios

```js
// MAL — Express puede enviar dos responses y crashear
if (!nombre) {
    res.status(400).json({ message: 'Falta nombre' });
    // Sin return → el código sigue ejecutando
}
res.json({ ok: true }); // ← Crash: headers already sent

// BIEN
if (!nombre) {
    return res.status(400).json({ message: 'Falta nombre' });
}
return res.json({ ok: true });
```

### Códigos de estado HTTP — los más importantes

| Código | Nombre              | Cuándo usarlo                                 |
|--------|---------------------|-----------------------------------------------|
| 200    | OK                  | GET o PUT exitoso                             |
| 201    | Created             | POST que crea un recurso nuevo                |
| 400    | Bad Request         | Datos inválidos o faltantes del cliente       |
| 401    | Unauthorized        | No autenticado (sin token)                    |
| 403    | Forbidden           | Autenticado pero sin permiso                  |
| 404    | Not Found           | El recurso no existe                          |
| 409    | Conflict            | Duplicado (ej: email ya registrado)           |
| 500    | Internal Server Error | Error inesperado del servidor               |

**Ejemplo real — `ProyectosController.js`:**
```js
static async crearProyecto(req, res) {
    try {
        const { nombre, monto_acordado, id_cliente } = req.body;

        if (!nombre || !id_cliente) {
            return res.status(400).json({ message: 'Faltan datos requeridos' });
        }

        const resultado = await Proyectos.insertarProyecto(nombre, monto_acordado, id_cliente);
        return res.status(201).json({   // ← 201, no 200
            ok: true,
            id_proyecto: resultado.insertId,
            codigo_interno: codigoFinal
        });
    } catch (error) {
        console.error('[ProyectosController.crearProyecto]', error);
        return res.status(500).json({ message: 'Error al crear proyecto' });
    }
}
```

---

# DÍA 3 — Modelos y Base de Datos

## 3.1 El Modelo

El modelo es la única capa que habla con la base de datos.
**Solo SQL aquí.** Sin lógica de negocio, sin validaciones, sin `req` ni `res`.

```js
// model/ProyectosModel.js
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

export async function insertarProyecto(nombre, monto, idCliente) {
    return db().ejecutarQuery(
        `INSERT INTO proyectos (nombre, monto_acordado, id_cliente, activo)
         VALUES (?, ?, ?, 1)`,
        [nombre, monto, idCliente]
    );
}

export async function obtenerProyectoPorId(id) {
    const rows = await db().ejecutarQuery(
        `SELECT p.*, c.nombre AS nombre_cliente
         FROM proyectos p
         LEFT JOIN clientes c ON c.id = p.id_cliente
         WHERE p.id_proyecto = ? AND p.activo = 1`,
        [id]
    );
    return rows[0] ?? null;  // Retorna el objeto o null
}
```

---

## 3.2 El pool de conexiones (Patrón Singleton)

Conectarse a MySQL por cada request es lento y consume recursos.
La solución: un **pool** de conexiones reutilizables.

```
Sin pool:              Con pool:
request 1 → conectar  request 1 ─┐
request 2 → conectar  request 2  ├─ usan las mismas conexiones del pool
request 3 → conectar  request 3 ─┘  (ya abiertas)
... muy lento         ... muy rápido
```

**El Singleton garantiza que solo existe UN pool en toda la app.**

```js
// config/Database.js — patrón Singleton
class DataBase {
    static getInstance() {
        if (!DataBase.instance) {
            DataBase.instance = new DataBase(); // Solo se crea una vez
        }
        return DataBase.instance; // Siempre retorna el mismo
    }
}
```

Uso en cualquier parte del código:
```js
const db = DataBase.getInstance(); // Misma instancia en todos lados
const rows = await db.ejecutarQuery('SELECT * FROM proyectos', []);
```

---

## 3.3 SQL con parámetros — Prevenir SQL Injection

**SQL Injection** es el ataque más común a bases de datos.
Si construyes queries concatenando strings, cualquiera puede destruir tu DB.

```js
// ❌ PELIGROSO — SQL Injection posible
const nombre = req.body.nombre; // Si nombre = "'; DROP TABLE proyectos; --"
await db.query(`SELECT * FROM proyectos WHERE nombre = '${nombre}'`);
// La query resultante destruye tu tabla

// ✅ SEGURO — Parámetros con placeholders
await db.ejecutarQuery(
    `SELECT * FROM proyectos WHERE nombre = ?`,
    [nombre]   // MySQL2 escapa el valor automáticamente
);
```

El `?` es un placeholder. MySQL2 sanitiza el valor antes de insertarlo.
**Siempre usa `?` para valores que vienen del usuario.**

---

## 3.4 Transacciones — Cuando todo debe exitir o nada

Imagina que registras un retiro de socio en dos operaciones:
1. `INSERT` en retiros
2. `UPDATE` del saldo disponible

Si la app cae entre medio, el retiro queda registrado pero el saldo no se actualiza. **Inconsistencia.**

La transacción garantiza que las dos operaciones son atómicas: o ambas ocurren, o ninguna.

```js
// config/Database.js — withTransaction
async withTransaction(work) {
    const connection = await this.getConnection();
    try {
        await connection.beginTransaction();  // Inicia la transacción
        const result = await work(connection); // Ejecuta el bloque
        await connection.commit();             // Confirma si todo salió bien
        return result;
    } catch (error) {
        await connection.rollback();           // Revierte si algo falla
        throw error;                           // Relanza para que el controlador lo maneje
    } finally {
        connection.release();                  // SIEMPRE liberar la conexión al pool
    }
}
```

**Ejemplo real — `RetirosSociosController.js`:**

```js
const { resultado, disponibleData } = await db.withTransaction(async (conn) => {
    // Bloquea la fila durante la transacción (evita race condition)
    await conn.query('SELECT id FROM socios WHERE id = ? FOR UPDATE', [id]);

    // Verifica saldo antes de insertar
    const data = await getPartnerAvailableAmount(id, queryPeriodo);
    if (montoFinal > Number(data.disponible)) {
        throw Object.assign(new Error('Monto excede disponible'), { status: 400 });
    }

    // Las dos operaciones dentro de la misma transacción
    const res = await retiros.insertRetiro(id, montoFinal, fechaFinal, ...);
    return { resultado: res, disponibleData: data };
});
```

Si `insertRetiro` falla, el `rollback` automático revierte todo. Nada queda a medias.

---

## 3.5 Diseño de tablas — Buenas prácticas

### Claves primarias y foráneas

```sql
CREATE TABLE proyectos (
    id_proyecto     INT AUTO_INCREMENT PRIMARY KEY,  -- PK: único, autoincrementable
    id_cliente      INT NOT NULL,                     -- FK: referencia a clientes
    nombre          VARCHAR(255) NOT NULL,
    monto_acordado  DECIMAL(15, 2),
    activo          TINYINT(1) NOT NULL DEFAULT 1,   -- Soft delete
    creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_cliente) REFERENCES clientes(id)  -- Integridad referencial
);
```

### Soft Delete vs Hard Delete

```sql
-- Hard delete: elimina la fila — PELIGROSO, no hay recuperación
DELETE FROM proyectos WHERE id_proyecto = 5;

-- Soft delete: marca como inactivo — siempre preferido
UPDATE proyectos SET activo = 0 WHERE id_proyecto = 5;
```

En los SELECT siempre filtras `WHERE activo = 1`. El dato queda en la DB si lo necesitas auditar.

### Índices — Acelerar queries

```sql
-- Sin índice: MySQL lee TODA la tabla para encontrar proyectos de un cliente
SELECT * FROM proyectos WHERE id_cliente = 10;  -- SLOW TABLE SCAN

-- Con índice: MySQL va directo al resultado
CREATE INDEX idx_cliente ON proyectos(id_cliente);  -- FAST INDEX SCAN
```

Crea índices en columnas que usas frecuentemente en `WHERE`, `JOIN`, u `ORDER BY`.

---

# DÍA 4 — Servicios, Patrones Avanzados y Seguridad

## 4.1 ¿Cuándo crear un Servicio?

Un servicio es una capa extra entre el controlador y el modelo.
Lo usas cuando la lógica es **compleja, reutilizable, o involucra múltiples modelos**.

```
Controlador simple:
   Controller → Model → DB

Con lógica compleja (usa Service):
   Controller → Service → [Model A, Model B, Model C] → DB
```

**Ejemplo real — `financeService.js` calcula el resumen financiero:**
Este cálculo involucra: ingresos, costos fijos, costos variables, socios, inversiones.
Ponerlo en el controlador haría el controlador de 300 líneas. En el servicio, el controlador queda en 5 líneas:

```js
// FinanzasController.js — simple gracias al servicio
static async obtenerResumen(req, res) {
    try {
        const data = await getFinancialSummary(req.query || {});
        return res.json(data);
    } catch (error) {
        console.error('[FinanzasController.obtenerResumen]', error);
        return res.status(500).json({ message: 'Error al obtener resumen' });
    }
}
```

---

## 4.2 Paginación

Nunca devuelvas 10.000 filas de una vez. Siempre pagina.

```js
// utils/pagination.js
export function parsePagination(query = {}, options = {}) {
    const defaultLimit = options.defaultLimit || 100;
    const maxLimit = options.maxLimit || 500;

    // Si pide ?all=true → retorna null (sin paginación, con cuidado)
    if (String(query?.all).toLowerCase() === 'true') return null;

    const limit = Math.min(Number(query.limit) || defaultLimit, maxLimit);
    const page  = Number(query.page) || 1;
    const offset = Number(query.offset) || (page - 1) * limit;

    return { limit, page, offset };
}
```

En el modelo:
```js
export async function listarProyectos({ limit = 100, offset = 0 } = {}) {
    return db().ejecutarQuery(
        `SELECT * FROM proyectos WHERE activo = 1 LIMIT ? OFFSET ?`,
        [limit, offset]
    );
}
```

En el controlador:
```js
const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
const data = await Proyectos.listar(pagination ?? {});
if (pagination) {
    res.set('x-pagination-limit', String(pagination.limit));
    res.set('x-pagination-offset', String(pagination.offset));
}
return res.json(data);
```

---

## 4.3 Crons — Tareas programadas en background

Un cron ejecuta código en intervalos sin que nadie lo llame por HTTP.

```js
// app.js — cron que corre cada 5 minutos
setInterval(() => {
    ejecutarRecordatoriosCalendario().catch(err => {
        console.error('[CRON] Error:', err.message);
    });
}, 5 * 60 * 1000);
```

**Problema:** si el cron tarda más que el intervalo, se acumulan ejecuciones.
**Solución:** bandera `corriendo` que lo previene.

```js
// services/calendarioReminderService.js
let corriendo = false;

export async function ejecutarRecordatoriosCalendario() {
    if (corriendo) return; // Ya está corriendo, saltar esta ejecución
    corriendo = true;
    try {
        // ... lógica del cron
    } finally {
        corriendo = false; // SIEMPRE resetear, aunque falle
    }
}
```

El `finally` garantiza que `corriendo = false` aunque el cron lance una excepción.
Sin `finally`, si hay un error, `corriendo` queda en `true` para siempre y el cron nunca vuelve a correr.

---

## 4.4 Seguridad — Checklist mínimo

### CORS — Controlar qué frontends pueden acceder

```js
// app.js
const allowedOrigins = ['https://mi-app.vercel.app', 'https://mi-dominio.cl'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Origin no permitido'));
    },
    credentials: true
}));
```

### Rate Limiting — Limitar requests por IP

```js
// Máximo 500 requests por minuto por IP
app.use(rateLimit({ windowMs: 60_000, max: 500 }));
```

Sin rate limiting, cualquiera puede hacer un loop que sature tu servidor.

### Helmet — Cabeceras de seguridad HTTP

```js
app.use(helmet()); // Agrega ~12 cabeceras de seguridad automáticamente
```

Previene ataques como clickjacking, XSS via headers, sniffing de MIME type.

### Validar SIEMPRE lo que llega del cliente

```js
// Nunca confíes en el frontend — valida en el backend siempre
const monto = Number(req.body.monto);
if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ message: 'Monto inválido' });
}

const id = req.params.id;
if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' });
}
```

---

## 4.5 Manejo de errores — La regla del `try/catch`

Todo método async en un controlador va dentro de `try/catch`.

```js
// Patrón estándar
static async miMetodo(req, res) {
    try {
        // lógica
    } catch (error) {
        console.error('[MiController.miMetodo]', error); // Siempre loguear
        return res.status(500).json({ message: 'Error del servidor' });
    }
}
```

**¿Por qué loguear `error` completo y no solo `error.message`?**
`error.message` es el texto. `error` completo incluye el stack trace (en qué línea ocurrió).
En producción, el log del stack trace es lo que te permite debuggear.

### Errores de negocio vs errores del servidor

```js
// Error de negocio (400) — el cliente hizo algo mal
if (monto > disponible) {
    return res.status(400).json({
        message: 'Monto excede el disponible',
        disponible,
        solicitado: monto
    });
}

// Error del servidor (500) — algo inesperado ocurrió internamente
} catch (error) {
    console.error('[Controller]', error);
    return res.status(500).json({ message: 'Error interno' });
    // No expongas el error real al cliente en producción
}
```

---

## 4.6 Estructura de carpetas — Guía rápida

```
control-back/
├── app.js                  ← Punto de entrada. Solo configuración y arranque.
├── config/
│   ├── Database.js         ← Singleton del pool MySQL
│   └── socket.js           ← WebSocket (Socket.io)
├── middleware/
│   └── requireAuth.js      ← Middlewares reutilizables
├── view/                   ← Routers Express (rutas)
│   └── proyectosRoutes.js
├── controller/             ← Controladores (req → res)
│   └── ProyectosController.js
├── model/                  ← SQL puro, acceso a la DB
│   └── Proyectos.js
├── services/               ← Lógica compleja y reutilizable
│   ├── financeService.js
│   └── billingReminderService.js
└── utils/                  ← Helpers pequeños y genéricos
    └── pagination.js
```

---

## Resumen — Las 10 reglas que debes aplicar siempre

1. **MVC estricto.** El controlador no escribe SQL. El modelo no responde HTTP.
2. **Siempre `return` antes de `res.json()`.** Un response por request.
3. **Siempre `try/catch` en async.** Y siempre loguear el error.
4. **Siempre `?` en queries SQL.** Nunca concatenes strings con datos del usuario.
5. **Siempre validar el input.** El frontend miente — valida en el backend.
6. **Códigos HTTP correctos.** 201 para crear, 400 para input malo, 404 para no encontrado.
7. **Variables de entorno para secretos.** Nunca en el código.
8. **Transacciones para operaciones atómicas.** Si dos cosas deben ocurrir juntas, van en una transacción.
9. **Soft delete sobre hard delete.** `activo = 0` en vez de `DELETE`.
10. **Servicios para lógica compleja.** Si el controlador supera ~50 líneas de lógica, extráela a un servicio.

---

## Para seguir aprendiendo con este proyecto

| Concepto                 | Dónde verlo en el código                              |
|--------------------------|-------------------------------------------------------|
| Singleton + Pool DB      | `config/Database.js`                                  |
| Middleware de auth       | `middleware/requireAuth.js`                           |
| Rutas RESTful            | `view/calendarioRoutes.js`                            |
| Controlador completo     | `controller/CalendarioController.js`                  |
| Transacción atómica      | `controller/RetirosSociosController.js` → `registrarRetiro` |
| Servicio complejo        | `services/financeService.js`                          |
| Cron con bandera         | `services/calendarioReminderService.js`               |
| Paginación               | `utils/pagination.js` + `controller/ProyectosController.js` |
| Validación de parámetros | `view/calendarioRoutes.js` → `router.param('id', ...)` |
| CORS + Seguridad         | `app.js` → `corsConfig` + `helmet` + `rateLimit`      |
