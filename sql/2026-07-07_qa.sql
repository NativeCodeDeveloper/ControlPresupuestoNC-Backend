-- ─── QA & Testing Module Migration ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_versiones (
    id_version   INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(200) NOT NULL,
    descripcion  TEXT         NULL,
    id_proyecto  INT          NULL,
    version_tag  VARCHAR(50)  NULL,
    estado       ENUM('Planificado','En Testing','Aprobado','Rechazado') NOT NULL DEFAULT 'Planificado',
    fecha_inicio   DATE NULL,
    fecha_objetivo DATE NULL,
    creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eliminado_en TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS qa_estados (
    id_estado  INT AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL,
    color_hex  VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
    orden      INT          NOT NULL DEFAULT 0,
    es_aprobado TINYINT(1)  NOT NULL DEFAULT 0,
    es_rechazo  TINYINT(1)  NOT NULL DEFAULT 0,
    activo      TINYINT(1)  NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qa_etiquetas (
    id_etiqueta INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    color_hex   VARCHAR(7)  NOT NULL DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS qa_casos (
    id_caso          INT AUTO_INCREMENT PRIMARY KEY,
    numero_caso      VARCHAR(20)  NOT NULL UNIQUE,
    id_version       INT          NOT NULL,
    titulo           VARCHAR(300) NOT NULL,
    tipo             ENUM('Funcional','Regresion','Integracion','UI','Rendimiento','Seguridad') NOT NULL DEFAULT 'Funcional',
    prioridad        ENUM('baja','media','alta','critica') NOT NULL DEFAULT 'media',
    id_estado        INT          NOT NULL,
    id_responsable   INT          NULL,
    descripcion      TEXT         NULL,
    pasos            TEXT         NULL,
    resultado_esperado TEXT       NULL,
    resultado_actual   TEXT       NULL,
    observaciones    TEXT         NULL,
    creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    eliminado_en     TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (id_version)     REFERENCES qa_versiones(id_version) ON DELETE CASCADE,
    FOREIGN KEY (id_estado)      REFERENCES qa_estados(id_estado),
    FOREIGN KEY (id_responsable) REFERENCES socios(id_socio) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS qa_caso_etiquetas (
    id_caso     INT NOT NULL,
    id_etiqueta INT NOT NULL,
    PRIMARY KEY (id_caso, id_etiqueta),
    FOREIGN KEY (id_caso)     REFERENCES qa_casos(id_caso)     ON DELETE CASCADE,
    FOREIGN KEY (id_etiqueta) REFERENCES qa_etiquetas(id_etiqueta) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qa_actividad (
    id_actividad    INT AUTO_INCREMENT PRIMARY KEY,
    id_caso         INT          NOT NULL,
    tipo            ENUM('creacion','comentario','cambio_estado','actualizacion') NOT NULL,
    contenido       TEXT         NULL,
    estado_anterior VARCHAR(100) NULL,
    estado_nuevo    VARCHAR(100) NULL,
    id_socio        INT          NULL,
    creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_caso)    REFERENCES qa_casos(id_caso) ON DELETE CASCADE,
    FOREIGN KEY (id_socio)   REFERENCES socios(id_socio)  ON DELETE SET NULL
);

-- Estados por defecto
INSERT INTO qa_estados (nombre, color_hex, orden, es_aprobado, es_rechazo) VALUES
    ('Pendiente',   '#6b7280', 1, 0, 0),
    ('En Progreso', '#3b82f6', 2, 0, 0),
    ('Aprobado',    '#22c55e', 3, 1, 0),
    ('Rechazado',   '#ef4444', 4, 0, 1),
    ('Bloqueado',   '#f59e0b', 5, 0, 0);

-- Etiquetas por defecto
INSERT INTO qa_etiquetas (nombre, color_hex) VALUES
    ('Regresion',   '#8b5cf6'),
    ('Critico',     '#ef4444'),
    ('Nuevo',       '#22c55e'),
    ('En revision', '#f59e0b');
