-- ─── QA / D.Q.T. — Tablero Scrumban + catálogos de tipo y prioridad ──────────
-- Reemplaza las 5 columnas por defecto por las 9 del modelo Scrumban de 2
-- personas, y convierte tipo/prioridad (hoy ENUM fijo) en catálogos editables
-- desde /config, igual que qa_estados.

-- ─── 1. Columnas del tablero (qa_estados) ────────────────────────────────────

INSERT INTO qa_estados (nombre, color_hex, orden, es_aprobado, es_rechazo, activo) VALUES
    ('Backlog',                  '#6b7280', 1, 0, 0, 1),
    ('Refinamiento',             '#a855f7', 2, 0, 0, 1),
    ('Lista para desarrollar',   '#3b82f6', 3, 0, 0, 1),
    ('En desarrollo',            '#0ea5e9', 4, 0, 0, 1),
    ('Revisión de código',       '#8b5cf6', 5, 0, 0, 1),
    ('Pruebas / Validación',     '#f59e0b', 6, 0, 0, 1),
    ('Listo para desplegar',     '#14b8a6', 7, 0, 0, 1),
    ('Terminado',                '#22c55e', 8, 1, 0, 1),
    ('Bloqueado',                '#ef4444', 9, 0, 1, 1);

-- Reasignar los casos existentes a su columna equivalente más cercana.
UPDATE qa_casos c
    JOIN qa_estados old ON c.id_estado = old.id_estado AND old.nombre = 'Pendiente'
    JOIN qa_estados new ON new.nombre = 'Backlog'
    SET c.id_estado = new.id_estado;

UPDATE qa_casos c
    JOIN qa_estados old ON c.id_estado = old.id_estado AND old.nombre = 'En Progreso'
    JOIN qa_estados new ON new.nombre = 'En desarrollo'
    SET c.id_estado = new.id_estado;

UPDATE qa_casos c
    JOIN qa_estados old ON c.id_estado = old.id_estado AND old.nombre = 'Aprobado'
    JOIN qa_estados new ON new.nombre = 'Terminado'
    SET c.id_estado = new.id_estado;

UPDATE qa_casos c
    JOIN qa_estados old ON c.id_estado = old.id_estado AND old.nombre = 'Rechazado'
    JOIN qa_estados new ON new.nombre = 'Bloqueado'
    SET c.id_estado = new.id_estado;

UPDATE qa_casos c
    JOIN qa_estados old ON c.id_estado = old.id_estado AND old.nombre = 'Bloqueado' AND old.orden < 9
    JOIN qa_estados new ON new.nombre = 'Bloqueado' AND new.orden = 9
    SET c.id_estado = new.id_estado
    WHERE old.id_estado <> new.id_estado;

-- Desactivar las 5 columnas viejas (no se borran, para no perder trazabilidad
-- histórica en qa_actividad, que guarda estado_anterior/estado_nuevo como texto).
UPDATE qa_estados SET activo = 0
WHERE nombre IN ('Pendiente', 'En Progreso', 'Aprobado', 'Rechazado')
   OR (nombre = 'Bloqueado' AND orden < 9);

-- ─── 2. Catálogo de Tipos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_tipos (
    id_tipo   INT AUTO_INCREMENT PRIMARY KEY,
    nombre    VARCHAR(100) NOT NULL,
    color_hex VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
    orden     INT          NOT NULL DEFAULT 0,
    activo    TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO qa_tipos (nombre, color_hex, orden) VALUES
    ('Funcional',    '#0ea5e9', 1),
    ('Regresion',    '#8b5cf6', 2),
    ('Integracion',  '#22c55e', 3),
    ('UI',           '#ec4899', 4),
    ('Rendimiento',  '#f59e0b', 5),
    ('Seguridad',    '#ef4444', 6);

-- ─── 3. Catálogo de Prioridades ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_prioridades (
    id_prioridad INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    color_hex    VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
    orden        INT          NOT NULL DEFAULT 0,
    activo       TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO qa_prioridades (nombre, color_hex, orden) VALUES
    ('baja',    '#94a3b8', 1),
    ('media',   '#fbbf24', 2),
    ('alta',    '#fb923c', 3),
    ('critica', '#f87171', 4);

-- ─── 4. Migrar qa_casos de ENUM string a FK ───────────────────────────────────

ALTER TABLE qa_casos
    ADD COLUMN id_tipo      INT NULL AFTER tipo,
    ADD COLUMN id_prioridad INT NULL AFTER prioridad;

UPDATE qa_casos c
    JOIN qa_tipos t ON t.nombre = c.tipo
    SET c.id_tipo = t.id_tipo;

UPDATE qa_casos c
    JOIN qa_prioridades p ON p.nombre = c.prioridad
    SET c.id_prioridad = p.id_prioridad;

-- Respaldo por si algún caso no matcheó (no debería pasar dado el ENUM cerrado).
UPDATE qa_casos SET id_tipo = (SELECT id_tipo FROM qa_tipos WHERE nombre = 'Funcional') WHERE id_tipo IS NULL;
UPDATE qa_casos SET id_prioridad = (SELECT id_prioridad FROM qa_prioridades WHERE nombre = 'media') WHERE id_prioridad IS NULL;

ALTER TABLE qa_casos
    MODIFY COLUMN id_tipo      INT NOT NULL,
    MODIFY COLUMN id_prioridad INT NOT NULL,
    ADD CONSTRAINT fk_qa_casos_tipo      FOREIGN KEY (id_tipo)      REFERENCES qa_tipos(id_tipo),
    ADD CONSTRAINT fk_qa_casos_prioridad FOREIGN KEY (id_prioridad) REFERENCES qa_prioridades(id_prioridad),
    DROP COLUMN tipo,
    DROP COLUMN prioridad;
