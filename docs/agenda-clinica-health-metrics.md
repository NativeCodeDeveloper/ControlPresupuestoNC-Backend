# Health Metrics — integración Agenda Clínica → NativeCode Finance

> **Para:** Nico (Agenda Clínica)
> **Objetivo:** Que Finance pueda ver, por cliente, si está usando la plataforma o si se está por
> ir — para poder llamarlo y retenerlo ANTES de que cancele, no enterarnos después.
> **Estado:** Finance ya tiene todo listo para consumir esto (caché, cron, UI). Solo falta un
> endpoint nuevo de tu lado. Nada de lo de acá requiere tocar tu backend salvo agregar este único
> endpoint.

---

## 1. Por qué esto importa (contexto de negocio)

Hoy en Finance existe "Health Score": una tarjeta por cliente que combina comportamiento de pago
(ya funcionando) con uso de la plataforma (pendiente — esto). El objetivo NO es solo tener un
número bonito — es detectar temprano a un cliente que está dejando de usar Agenda Clínica, para
que el equipo lo contacte antes de que decida cancelar. Hoy no tenemos ninguna señal de eso: un
cliente puede llevar semanas sin entrar y no nos enteramos hasta que cancela.

**Importante:** la señal principal NO debe ser un acumulado mensual ("reservas del último mes").
Eso reacciona demasiado lento — si esperamos a que un mes completo se vea mal, probablemente el
cliente ya decidió irse. Lo que más nos sirve es **qué tan reciente fue su última actividad** y
**si su actividad está cayendo esta semana**, no un total acumulado.

---

## 2. El endpoint que necesitamos

```
GET /health-metrics
```

Un endpoint nuevo en tu backend, uno por cada instancia/cliente (mismo código, cada cliente ya
corre su propia URL — Finance ya sabe cuál es la de cada uno).

### Autenticación

`Authorization: Bearer <api_key>`

Esa API key ya existe — se generó y quedó guardada (cifrada) en Finance cuando se configuró la
ruta de backend de cada cliente en el Production Cockpit. Solo necesitamos que tu endpoint la
valide contra el valor que ya tienes/te pasamos (a coordinar cuál es la fuente de verdad de esa
key de tu lado — puede ser una variable de entorno fija por instancia, lo más simple).

Si el token no es válido: `401`.

### Response — 200 OK

```json
{
  "diasSinActividad": 4,
  "tendenciaSemanal": -35,
  "reservas": 42,
  "confirmaciones": 78,
  "fichasClinicas": 11
}
```

| Campo | Tipo | Definición de negocio |
|---|---|---|
| `diasSinActividad` | `number` | Días desde la última reserva creada **o** el último ingreso del cliente a la plataforma (lo que sea más reciente). Si nunca ha entrado, mandar `null`. **Esta es la señal más importante — la que más pesa en el score.** |
| `tendenciaSemanal` | `number` | % de cambio en reservas: `(reservas últimos 7 días − reservas 7 días anteriores) / reservas 7 días anteriores × 100`. Negativo = está cayendo. Si no hay actividad en el período anterior para calcular %, mandar `null` en vez de forzar un número. |
| `reservas` | `number` | Cantidad de reservas creadas en los últimos 30 días (contexto de volumen, no es la señal de alerta). |
| `confirmaciones` | `number` | % de reservas de los últimos 30 días con `estadoReserva` en `asiste` o `finalizado` (asistencia real, no solo "reservada"/"confirmada"). |
| `fichasClinicas` | `number` | Cantidad de fichas clínicas creadas en los últimos 30 días. |

Cualquier campo que no se pueda calcular: mandar `null`, no `0` — un `0` real (ej. "cero reservas
esta semana") y un `0` por falta de datos son cosas distintas, y Finance necesita distinguirlos
para no marcar a un cliente como "crítico" por un dato que en realidad no se pudo calcular.

### Errores

Si algo falla de tu lado, cualquier status ≠ 200 sirve — Finance ya maneja el caso "no se pudo
traer esto hoy" sin romper nada (no bloquea el resto del health score de ese cliente).

---

## 3. Qué pasa del lado de Finance (ya construido, para tu contexto)

- Finance NO va a llamar este endpoint en vivo cada vez que alguien abre la página de Health Score
  (serían 30+ llamadas HTTP a servidores distintos en cada carga — lento y frágil si uno está
  caído). Va a haber un cron en Finance (una vez al día) que llama a `/health-metrics` de cada
  cliente y guarda el resultado en una caché propia.
- El health score de cada cliente ya tiene la estructura lista para estos 5 campos (con pesos
  definidos: `diasSinActividad` 35%, `tendenciaSemanal` 25%, `reservas` 15%, `confirmaciones` 15%,
  `fichasClinicas` 10%) — hoy están en placeholder (`0`/`null`) porque no hay de dónde traerlos
  todavía. En cuanto el endpoint exista, se activa la llamada real y esos placeholders se
  reemplazan solos, sin tocar el resto del sistema.

---

## 4. Pasos para conectar esto

1. **Nico**: implementar `GET /health-metrics` en el backend de Agenda Clínica, con la respuesta
   de la sección 2. No requiere tocar el frontend de Agenda Clínica ni cambiar nada existente —
   es un endpoint nuevo, aditivo.
2. **Nico + Finance**: acordar cómo se valida la API key del lado de Agenda Clínica (variable de
   entorno por instancia es lo más simple, dado que cada cliente ya corre su propia URL).
3. **Probar con UN cliente primero** (no los 30+ de una): Finance hace un `curl` manual contra ese
   endpoint con la key real y confirma que la forma de la respuesta calza.
4. **Finance**: activar `_fetchAgendaClinicaMetrics` (ya escrito y comentado en
   `services/healthScoreService.js`), armar el cron + tabla de caché (mismo patrón que el
   snapshot diario de Health Score que ya existe), y sumar estos pesos al cálculo del score.
5. **Rollout al resto de clientes**: como todos corren el mismo código, una vez validado con el
   primero, se repite solo cambiando la URL/key de cada uno — no hay trabajo de desarrollo
   adicional por cliente, solo configuración.
