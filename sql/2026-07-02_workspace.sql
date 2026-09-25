-- Workspace Iniciativas
CREATE TABLE IF NOT EXISTS workspace_iniciativas (
    id_iniciativa   INT AUTO_INCREMENT PRIMARY KEY,
    titulo          VARCHAR(255) NOT NULL,
    resumen         VARCHAR(500) NULL,
    estado          ENUM('activa','pausada','completada') NOT NULL DEFAULT 'activa',
    prioridad       ENUM('sin_prioridad','urgente','alta','media','baja') NOT NULL DEFAULT 'sin_prioridad',
    propietario     VARCHAR(100) NULL,
    fecha_objetivo  DATE NULL,
    contenido       LONGTEXT NULL,
    color_hex       VARCHAR(7) NOT NULL DEFAULT '#8B5CF6',
    orden           INT NOT NULL DEFAULT 0,
    activo          TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_orden  (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
