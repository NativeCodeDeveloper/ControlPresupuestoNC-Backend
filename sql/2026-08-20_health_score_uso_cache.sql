-- ============================================================
-- Migración: Tabla health_score_uso_cache
-- Propósito: Caché de las métricas de USO (Agenda Clínica) por cliente,
--            para que Health Score no tenga que llamar en vivo al backend
--            de cada cliente en cada carga de página (30+ llamadas HTTP a
--            servidores externos distintos por carga — lento y frágil si
--            uno está caído).
-- Fecha: 2026-08-20
-- ============================================================
--
-- Se llena vía cron (refreshUsoMetricsCache en healthScoreService.js),
-- una vez al día, recorriendo los clientes con ruta_backend + api_key
-- configurados. Si un cliente falla, su fila simplemente no se actualiza
-- ese día — queda el último dato bueno conocido, no se rompe el resto.
--
-- nombre_cliente (no id_proyecto) porque es la misma clave que ya usa
-- todo el resto de Health Score (proyectos.nombre_cliente, agrupado por
-- cliente, no por proyecto individual — ver healthScoreService.js).

CREATE TABLE IF NOT EXISTS health_score_uso_cache (
    id_score            INT AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente      VARCHAR(255) NOT NULL,
    dias_sin_actividad  INT NULL,
    tendencia_semanal   INT NULL,
    reservas            INT NULL,
    confirmaciones      INT NULL,
    fichas_clinicas     INT NULL,
    fetched_at          TIMESTAMP NULL,
    ultimo_error        VARCHAR(500) NULL,
    creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_health_score_uso_cache_cliente (nombre_cliente)
);

SELECT '✅ Migración finalizada: health_score_uso_cache creada' AS estado;
