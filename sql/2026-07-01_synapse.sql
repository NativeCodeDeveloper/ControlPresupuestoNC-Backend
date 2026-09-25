-- ============================================================
-- NativeCode Finance — Synapse: Sistema de Tareas y Tickets
-- Ejecutar completo en phpMyAdmin
-- ============================================================

CREATE TABLE IF NOT EXISTS `synapse_estados` (
  `id_estado` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `color_hex` varchar(7) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '#6B7280',
  `orden` int NOT NULL DEFAULT 0,
  `es_final` tinyint(1) NOT NULL DEFAULT 0,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `synapse_estados` (`nombre`, `color_hex`, `orden`, `es_final`) VALUES
  ('Pendiente',   '#6B7280', 1, 0),
  ('En progreso', '#3B82F6', 2, 0),
  ('En revisión', '#F59E0B', 3, 0),
  ('Completado',  '#10B981', 4, 1),
  ('Cancelado',   '#EF4444', 5, 1);

CREATE TABLE IF NOT EXISTS `synapse_etiquetas` (
  `id_etiqueta` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `color_hex` varchar(7) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '#6B7280',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_etiqueta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `synapse_etiquetas` (`nombre`, `color_hex`) VALUES
  ('Bug',     '#EF4444'),
  ('Feature', '#3B82F6'),
  ('Soporte', '#F59E0B'),
  ('Mejora',  '#8B5CF6'),
  ('Urgente', '#DC2626');

CREATE TABLE IF NOT EXISTS `synapse_tareas` (
  `id_tarea` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_general_ci,
  `id_estado` int NOT NULL,
  `id_proyecto` int DEFAULT NULL,
  `id_asignado` int DEFAULT NULL,
  `prioridad` enum('baja','media','alta','urgente') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'media',
  `tipo` enum('tarea','ticket','bug','feature','soporte') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'tarea',
  `fecha_ingreso` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `fecha_completado` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado_en` datetime DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_tarea`),
  KEY `idx_syn_tareas_estado` (`id_estado`),
  KEY `idx_syn_tareas_proyecto` (`id_proyecto`),
  KEY `idx_syn_tareas_asignado` (`id_asignado`),
  KEY `idx_syn_tareas_activo` (`activo`),
  CONSTRAINT `fk_syn_tareas_estado` FOREIGN KEY (`id_estado`) REFERENCES `synapse_estados` (`id_estado`),
  CONSTRAINT `fk_syn_tareas_proyecto` FOREIGN KEY (`id_proyecto`) REFERENCES `proyectos` (`id_proyecto`) ON DELETE SET NULL,
  CONSTRAINT `fk_syn_tareas_asignado` FOREIGN KEY (`id_asignado`) REFERENCES `socios` (`id_socio`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `synapse_tarea_etiquetas` (
  `id_tarea` int NOT NULL,
  `id_etiqueta` int NOT NULL,
  PRIMARY KEY (`id_tarea`, `id_etiqueta`),
  CONSTRAINT `fk_ste_tarea` FOREIGN KEY (`id_tarea`) REFERENCES `synapse_tareas` (`id_tarea`) ON DELETE CASCADE,
  CONSTRAINT `fk_ste_etiqueta` FOREIGN KEY (`id_etiqueta`) REFERENCES `synapse_etiquetas` (`id_etiqueta`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `synapse_comentarios` (
  `id_comentario` int NOT NULL AUTO_INCREMENT,
  `id_tarea` int NOT NULL,
  `contenido` text COLLATE utf8mb4_general_ci NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_comentario`),
  KEY `idx_syn_comentarios_tarea` (`id_tarea`),
  CONSTRAINT `fk_syn_comentarios_tarea` FOREIGN KEY (`id_tarea`) REFERENCES `synapse_tareas` (`id_tarea`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SELECT '✅ Synapse: 5 tablas creadas correctamente.' AS estado;
