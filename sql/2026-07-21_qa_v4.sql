-- ─── D.Q.T. — Estados de versión configurables (con orden) ───────────────────
-- Convierte qa_versiones.estado (ENUM fijo: Planificado/En Testing/Aprobado/
-- Rechazado) en un catálogo editable desde /config, igual que qa_estados,
-- qa_tipos y qa_prioridades.

CREATE TABLE IF NOT EXISTS qa_version_estados (
    id_estado_version INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    color_hex    VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
    orden        INT          NOT NULL DEFAULT 0,
    es_aprobado  TINYINT(1)   NOT NULL DEFAULT 0,
    es_rechazo   TINYINT(1)   NOT NULL DEFAULT 0,
    activo       TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO qa_version_estados (nombre, color_hex, orden, es_aprobado, es_rechazo) VALUES
    ('Planificado', '#94a3b8', 1, 0, 0),
    ('En Testing',  '#38bdf8', 2, 0, 0),
    ('Aprobado',    '#22c55e', 3, 1, 0),
    ('Rechazado',   '#ef4444', 4, 0, 1);

ALTER TABLE qa_versiones
    ADD COLUMN id_estado_version INT NULL AFTER estado;

UPDATE qa_versiones v
    JOIN qa_version_estados ve ON ve.nombre = v.estado
    SET v.id_estado_version = ve.id_estado_version;

-- Respaldo por si alguna versión quedó sin matchear (no debería pasar dado el ENUM cerrado).
UPDATE qa_versiones SET id_estado_version = (SELECT id_estado_version FROM qa_version_estados WHERE nombre = 'Planificado')
WHERE id_estado_version IS NULL;

ALTER TABLE qa_versiones
    MODIFY COLUMN id_estado_version INT NOT NULL,
    ADD CONSTRAINT fk_qa_versiones_estado FOREIGN KEY (id_estado_version) REFERENCES qa_version_estados(id_estado_version),
    DROP COLUMN estado;
