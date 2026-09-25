# Health Score — migrar un cliente antiguo

> **Cuándo usar esto:** para los ~49 clientes que ya están en producción con el backend viejo.
> Los clientes **nuevos** no necesitan nada de esto: heredan el código y la base padre, que ya
> traen todo. Ver `health-score-implementacion.md`.
>
> **Validado el 2026-09-25** contra el entorno de desarrollo, de punta a punta.

---

## Qué le falta a un cliente antiguo

| Pieza | Nuevo | Antiguo |
|---|---|---|
| Código del endpoint `/health-metrics` | ✅ heredado | ❌ hay que desplegar |
| Dependencia `@clerk/backend` | ✅ | ❌ hay que instalar |
| Tabla `registro_accesos` | ✅ base padre | ❌ hay que crear |
| `HEALTH_METRICS_API_KEY` en su `.env` | ✅ al aprovisionar | ❌ hay que agregar |
| `CLERK_SECRET_KEY` en su `.env` | ✅ | ❌ hay que agregar |
| Latido en el front | ✅ | ❌ requiere desplegar su front |

---

## Los pasos, en orden

El orden importa: el código consulta la tabla, así que si reinicias antes de crearla, el endpoint
devuelve 500.

### 1. Crear la tabla en la base de ESE cliente

> ⚠️ Cada clínica tiene **su propia base de datos**. Selecciónala en phpMyAdmin antes de pegar
> nada. Es el error más fácil de cometer: si vienes de otra pestaña, la tabla cae donde no va.

```sql
CREATE TABLE IF NOT EXISTS registro_accesos (
    id_acceso        BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_clerk_id VARCHAR(191) NULL,
    usuario_email    VARCHAR(255) NULL,
    usuario_nombre   VARCHAR(255) NULL,
    rol              VARCHAR(60)  NULL,
    id_profesional   INT          NULL,
    ip               VARCHAR(45)  NULL,
    user_agent       VARCHAR(255) NULL,
    ocurrido_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_acceso),
    KEY idx_accesos_ocurrido_en (ocurrido_en),
    KEY idx_accesos_usuario (usuario_clerk_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Comprueba que cayó donde corresponde:

```sql
SELECT TABLE_SCHEMA FROM information_schema.TABLES WHERE TABLE_NAME = 'registro_accesos';
```

### 2. Las variables de entorno

En el `.env` del backend de ese cliente:

```
HEALTH_METRICS_API_KEY=<la clave global, la misma para todos>
CLERK_SECRET_KEY=<la sk_ de la instancia de Clerk de ESE cliente>
```

La primera es compartida: se lee del `.env` de cualquier backend ya configurado o del de Finance.
La segunda es individual y sale del panel de Clerk de ese cliente (API Keys → Secret key, la que
empieza con `sk_`).

### 3. Desplegar el código

```bash
cd <directorio del cliente>
git pull origin main
npm install --omit=dev      # <- NO lo saltes, ver abajo
pm2 restart <proceso> --update-env
```

### 4. Verificar — y esto no es opcional

```bash
pm2 describe <proceso> | grep -E "status|uptime"
pm2 logs <proceso> --lines 20 --nostream --err
```

Y desde fuera:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<url-del-cliente>/health-metrics
# esperado: 401  (existe y pide autenticación)

curl -s -H "Authorization: Bearer <la key global>" https://<url-del-cliente>/health-metrics
# esperado: {"diasSinActividad":...,"reservas":...,"confirmaciones":...,"fichasClinicas":...}
```

| Respuesta | Qué significa |
|---|---|
| `401` sin key | Correcto |
| `404` | El código no está desplegado en ese cliente |
| `503 apiKeyNoConfigurada` | Falta `HEALTH_METRICS_API_KEY` en su `.env` |
| `500 serverError` | Falta la tabla `registro_accesos`, o la base no responde |
| `502` | El proceso está caído — revisa el log |

### 5. Registrarlo en Finance

En **Production Cockpit → Backserver**, asocia el servidor del cliente a su proyecto. La
`ruta_backend` es la URL del **backend**, no la del front, y sin barra al final.

No hace falta configurar API key por servidor: sin key propia usa la global.

### 6. El front (opcional, pero es lo que da la señal principal)

Sin el latido en el front del cliente, `registro_accesos` queda vacía y `diasSinActividad` —el
35% del score— va en `null`. Las otras cuatro métricas funcionan igual.

Si vas a desplegar su front, incluye `src/app/dashboard/RegistroAcceso.jsx` y su montaje en el
layout del dashboard.

---

## Tres errores que cometimos y te van a pasar

**`npm install` no es opcional.** El código nuevo importa `@clerk/backend`. Desplegamos sin
instalar y el backend arrancó igual —porque el proceso viejo seguía corriendo— y recién se cayó
en el siguiente reinicio, horas después y sin relación aparente. El error es
`ERR_MODULE_NOT_FOUND`.

**`pm2` dice "online" aunque esté reiniciándose en bucle.** El estado no basta: hay que mirar el
log o golpear el endpoint. Un proceso que crashea al arrancar aparece igual como online con el
uptime reseteándose.

**La tabla en la base equivocada.** phpMyAdmin arrastra la base seleccionada entre pestañas. Nos
pasó: creamos `registro_accesos` en `finance_db` en vez de en la de Agenda Clínica.

---

## Revertir

Si algo sale mal en un cliente, volver atrás es una línea:

```bash
git revert <commit> && git push
# o directamente en el cliente:
git reset --hard <commit anterior> && pm2 restart <proceso>
```

La tabla `registro_accesos` puede quedarse: nadie más la consulta y está vacía o con telemetría.
Finance sigue funcionando con ese cliente en `404`, sin romper el health score de los demás.

---

## Anexo — la base de los clientes antiguos puede tener otras diferencias

La base de desarrollo no tenía la columna `fechaExpiracionPago` que el código espera, y el cron
de expiración de reservas fallaba cada 2 minutos. Si ves ese error en un cliente antiguo:

```sql
ALTER TABLE reservaPacientes ADD COLUMN fechaExpiracionPago DATETIME NULL;
```

No tiene relación con Health Score, pero aparece en el mismo log y confunde.
