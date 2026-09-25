-- Migración: Nexus Actualizaciones v2
-- Ejecutar una sola vez en phpMyAdmin sobre la BD finance_db

CREATE TABLE IF NOT EXISTS nexus_actualizacion_estados (
    id_estado  INT AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(80)  NOT NULL,
    color_hex  VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
    orden      INT          NOT NULL DEFAULT 0,
    activo     TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO nexus_actualizacion_estados (nombre, color_hex, orden) VALUES
('Ingresada',      '#6366f1', 1),
('En Desarrollo',  '#f59e0b', 2),
('Migración BD',   '#8b5cf6', 3),
('Enviada',        '#22c55e', 4);

ALTER TABLE nexus_actualizaciones
    ADD COLUMN id_estado INT  NULL          AFTER id_socio,
    ADD COLUMN prioridad VARCHAR(20) NOT NULL DEFAULT 'media' AFTER id_estado,
    ADD COLUMN modo      VARCHAR(20) NOT NULL DEFAULT 'masivo' AFTER prioridad;
