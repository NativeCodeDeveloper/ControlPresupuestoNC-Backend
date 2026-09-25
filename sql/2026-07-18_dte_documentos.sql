-- Migración: historial de Documentos Tributarios Electrónicos, control de folios y CAF cargados.
-- Fase 2 de la integración DTE — ver control-back/docs/INTEGRACION_DTE.md.
-- No depende de tener el CAF real todavía: las tablas quedan listas para cuando llegue.

CREATE TABLE IF NOT EXISTS `dte_caf` (
    `id`                 INT AUTO_INCREMENT PRIMARY KEY,
    `tipo_dte`           TINYINT NOT NULL COMMENT '33=Factura, 39=Boleta',
    `folio_desde`        INT NOT NULL,
    `folio_hasta`        INT NOT NULL,
    `ruta_archivo`       VARCHAR(500) NOT NULL COMMENT 'Ruta absoluta del XML del CAF en el servidor, fuera de git',
    `fecha_autorizacion` DATE NULL,
    `ambiente`           ENUM('certificacion','produccion') NOT NULL DEFAULT 'certificacion',
    `activo`             TINYINT(1) NOT NULL DEFAULT 1,
    `creado_en`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_dte_caf_rango` (`tipo_dte`, `folio_desde`, `folio_hasta`, `ambiente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `dte_folios_consumidos` (
    `id`               INT AUTO_INCREMENT PRIMARY KEY,
    `tipo_dte`         TINYINT NOT NULL,
    `folio`            INT NOT NULL,
    `ambiente`         ENUM('certificacion','produccion') NOT NULL DEFAULT 'certificacion',
    `id_dte_documento` INT NULL,
    `reservado_en`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_dte_folio` (`tipo_dte`, `folio`, `ambiente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `dte_documentos` (
    `id`              INT AUTO_INCREMENT PRIMARY KEY,
    `id_proyecto`     INT NOT NULL,
    `id_pago`         INT NULL,
    `tipo_dte`        TINYINT NOT NULL COMMENT '33=Factura, 39=Boleta, 61=Nota de Credito',
    `folio`           INT NOT NULL,
    `ambiente`        ENUM('certificacion','produccion') NOT NULL DEFAULT 'certificacion',
    `track_id`        VARCHAR(50) NULL,
    `estado_sii`      ENUM('pendiente','enviado','aceptado','rechazado','observado') NOT NULL DEFAULT 'pendiente',
    `monto_neto`      DECIMAL(12,2) NULL,
    `monto_iva`       DECIMAL(12,2) NULL,
    `monto_exento`    DECIMAL(12,2) NOT NULL DEFAULT 0,
    `monto_total`     DECIMAL(12,2) NOT NULL,
    `receptor_rut`    VARCHAR(12) NULL,
    `receptor_nombre` VARCHAR(100) NULL,
    `detalle_json`    JSON NULL COMMENT 'Lineas de detalle usadas, para "similar al ultimo" / "basado en anterior"',
    `xml_firmado`     MEDIUMTEXT NULL,
    `error_mensaje`   VARCHAR(500) NULL,
    `emitido_por`     VARCHAR(191) NULL COMMENT 'ID de usuario Clerk que emitio el documento',
    `emitido_en`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `activo`          TINYINT(1) NOT NULL DEFAULT 1,
    INDEX `idx_dte_proyecto` (`id_proyecto`),
    INDEX `idx_dte_estado` (`estado_sii`),
    UNIQUE KEY `uq_dte_folio_doc` (`tipo_dte`, `folio`, `ambiente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
