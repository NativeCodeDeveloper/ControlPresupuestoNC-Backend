-- ============================================================
-- Migración: Production Cockpit
-- Módulo: Synapse → Production Cockpit
-- Fecha: 2026-07-02
-- ============================================================

-- Columnas nuevas en proyectos (cockpit-specific)
ALTER TABLE `proyectos`
  ADD COLUMN `servidor`              VARCHAR(150) DEFAULT NULL  COMMENT 'Servidor / hosting del proyecto',
  ADD COLUMN `url_front`             VARCHAR(500) DEFAULT NULL  COMMENT 'URL frontend del proyecto',
  ADD COLUMN `cockpit_observaciones` TEXT         DEFAULT NULL  COMMENT 'Observaciones exclusivas del Production Cockpit';

-- Columnas nuevas en configuracion_financiera
ALTER TABLE `configuracion_financiera`
  ADD COLUMN `meta_mensual`     DECIMAL(15,2) DEFAULT 0    COMMENT 'Meta de ingresos mensual (Production Cockpit)',
  ADD COLUMN `cockpit_columnas` JSON          DEFAULT NULL  COMMENT 'Columnas visibles en Production Cockpit (JSON)';

-- ============================================================
-- Migración: Servidores Backend
-- Fecha: 2026-07-02
-- ============================================================

CREATE TABLE IF NOT EXISTS `synapse_servidores` (
  `id_servidor`   INT          NOT NULL AUTO_INCREMENT,
  `ruta_backend`  VARCHAR(500) NOT NULL  COMMENT 'URL del servidor backend',
  `estado`        ENUM('en_uso','sin_cliente','url_disponible','fuera_servicio') NOT NULL DEFAULT 'url_disponible',
  `id_proyecto`   INT          DEFAULT NULL COMMENT 'Proyecto/cliente asignado',
  `version`       VARCHAR(20)  DEFAULT NULL,
  `notas`         TEXT         DEFAULT NULL,
  `activo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_servidor`),
  KEY `idx_servidores_estado` (`estado`),
  KEY `idx_servidores_proyecto` (`id_proyecto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
