-- ============================================================
-- Migración: Tabla health_score_historial
-- Propósito: Snapshot diario de la distribución de cartera
--            (saludable/en riesgo/crítico) para graficar tendencia.
-- Fecha: 2026-08-04
-- ============================================================
--
-- Una fila por día (fecha UNIQUE). El cron de health score la
-- actualiza varias veces al día vía INSERT ... ON DUPLICATE KEY
-- UPDATE, así que siempre queda el snapshot más reciente de ese día
-- — no hay riesgo de duplicados aunque el server se reinicie varias
-- veces (como pasó hoy con los deploys).

CREATE TABLE IF NOT EXISTS health_score_historial (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    fecha      DATE NOT NULL,
    total      INT NOT NULL DEFAULT 0,
    healthy    INT NOT NULL DEFAULT 0,
    warning    INT NOT NULL DEFAULT 0,
    critical   INT NOT NULL DEFAULT 0,
    cancelled  INT NOT NULL DEFAULT 0,
    creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_health_score_historial_fecha (fecha)
);

SELECT '✅ Migración finalizada: health_score_historial creada' AS estado;
