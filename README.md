# ControlPresupuestoNC Backend

## Guía de Consumo API (Paginación)

Esta API ahora soporta paginación estándar en endpoints de listados para reducir carga de memoria y evitar respuestas masivas.

### Parámetros soportados

- `limit`: cantidad de registros por página.
- `page`: página (base 1).
- `offset`: desplazamiento absoluto. Si viene, tiene prioridad sobre `page`.
- `all=true`: desactiva paginación para ese request.

### Límites actuales

- `defaultLimit`: `500`
- `maxLimit`: `2000`

### Headers de respuesta

Cuando hay paginación activa, la respuesta incluye:

- `x-pagination-limit`
- `x-pagination-offset`

## Endpoints con paginación

- `GET /api/socios`
- `GET /api/proyectos`
- `GET /api/proyectos/:id/pagos`
- `GET /api/costos-fijos`
- `GET /api/costos-fijos/activos`
- `GET /api/costos-variables`
- `GET /api/costos-variables/tipo/:tipo_costo_id`
- `GET /api/costos-variables/proyecto/:proyecto_id`
- `GET /api/servicios`
- `GET /api/inversiones`
- `GET /api/socios/:id/retiros`

## Ejemplos rápidos

```bash
# Página 1, 100 registros
curl "http://localhost:3001/api/proyectos?limit=100&page=1"

# Offset directo
curl "http://localhost:3001/api/socios?limit=50&offset=150"

# Sin paginación (solo para catálogos chicos)
curl "http://localhost:3001/api/servicios?all=true"
```

## Recomendación de uso

- Vistas de tabla: usar siempre `limit/page`.
- Reportes o exportaciones grandes: procesar por páginas.
- `all=true`: usar solo en catálogos pequeños (selectores, combos).
