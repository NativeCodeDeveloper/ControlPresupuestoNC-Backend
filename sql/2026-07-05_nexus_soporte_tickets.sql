-- =============================================================
-- MIGRACIÓN: 2026-07-05 — Módulo Nexus: Tickets de Soporte
-- =============================================================
-- Crea 3 tablas nuevas. No modifica ninguna tabla existente.
-- Aplicar en producción ANTES de desplegar backend/frontend.
-- =============================================================

-- ----------------------------------------------------------------
-- 1. soporte_estados — estados configurables del ticket
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte_estados (
    id_estado   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(80)  NOT NULL,
    color_hex   VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    orden       INT          NOT NULL DEFAULT 0,
    es_cierre   TINYINT(1)   NOT NULL DEFAULT 0,
    activo      TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO soporte_estados (nombre, color_hex, orden, es_cierre) VALUES
    ('Abierto',                          '#22c55e', 1, 0),
    ('En revisión',                      '#3b82f6', 2, 0),
    ('En desarrollo',                    '#8b5cf6', 3, 0),
    ('Pendiente de información',         '#f59e0b', 4, 0),
    ('Resuelto',                         '#06b6d4', 5, 0),
    ('Cerrado',                          '#6b7280', 6, 1);

-- ----------------------------------------------------------------
-- 2. soporte_tickets — tabla principal
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte_tickets (
    id_ticket                   INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    numero_ticket               VARCHAR(20)   NOT NULL UNIQUE,
    id_proyecto                 INT           DEFAULT NULL,
    nombre_cliente              VARCHAR(150)  NOT NULL,
    email_cliente               VARCHAR(150)  NOT NULL,
    asunto                      VARCHAR(255)  NOT NULL,
    descripcion                 TEXT          NOT NULL,
    prioridad                   ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
    sla_horas                   INT           NOT NULL DEFAULT 24,
    sla_vence_en                DATETIME      DEFAULT NULL,
    id_estado                   INT           NOT NULL,
    id_responsable              INT           DEFAULT NULL,
    resolucion_causa            TEXT          DEFAULT NULL,
    resolucion_accion           TEXT          DEFAULT NULL,
    resolucion_resultado        TEXT          DEFAULT NULL,
    resolucion_observaciones    TEXT          DEFAULT NULL,
    email_apertura_message_id   VARCHAR(255)  DEFAULT NULL,
    creado_en                   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cerrado_en                  DATETIME      DEFAULT NULL,
    eliminado_en                DATETIME      DEFAULT NULL,
    CONSTRAINT fk_ticket_estado     FOREIGN KEY (id_estado)      REFERENCES soporte_estados(id_estado),
    CONSTRAINT fk_ticket_proyecto   FOREIGN KEY (id_proyecto)    REFERENCES proyectos(id_proyecto)  ON DELETE SET NULL,
    CONSTRAINT fk_ticket_socio      FOREIGN KEY (id_responsable) REFERENCES socios(id_socio)        ON DELETE SET NULL
);

-- ----------------------------------------------------------------
-- 3. soporte_actividad — historial interno (no visible al cliente)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte_actividad (
    id_actividad    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_ticket       INT          NOT NULL,
    tipo            ENUM('creacion','comentario','cambio_estado','resolucion','notificacion','cierre') NOT NULL,
    contenido       TEXT         DEFAULT NULL,
    estado_anterior VARCHAR(80)  DEFAULT NULL,
    estado_nuevo    VARCHAR(80)  DEFAULT NULL,
    id_socio        INT          DEFAULT NULL,
    creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_actividad_ticket  FOREIGN KEY (id_ticket) REFERENCES soporte_tickets(id_ticket) ON DELETE CASCADE,
    CONSTRAINT fk_actividad_socio   FOREIGN KEY (id_socio)  REFERENCES socios(id_socio)           ON DELETE SET NULL
);

-- ----------------------------------------------------------------
-- Verificación rápida
-- ----------------------------------------------------------------
-- SELECT TABLE_NAME, TABLE_ROWS
-- FROM information_schema.TABLES
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('soporte_estados','soporte_tickets','soporte_actividad');
