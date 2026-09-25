-- Migración: datos de receptor (cliente) y emisor (empresa) para Documentos Tributarios Electrónicos
-- Etapa 1 — solo formulario/PDF de borrador, sin conexión a LibreDTE/SII todavía.
-- Ver control-back/docs/INTEGRACION_DTE.md para el plan completo de integración futura.

ALTER TABLE `proyectos`
  ADD COLUMN `direccion_cliente` VARCHAR(200) DEFAULT NULL COMMENT 'Dirección del receptor para DTE',
  ADD COLUMN `comuna_cliente`    VARCHAR(100) DEFAULT NULL COMMENT 'Comuna del receptor para DTE';

ALTER TABLE `configuracion_financiera`
  ADD COLUMN `emisor_rut`                 VARCHAR(12)  DEFAULT NULL COMMENT 'RUT de la empresa emisora',
  ADD COLUMN `emisor_razon_social`        VARCHAR(200) DEFAULT NULL COMMENT 'Razón social SII del emisor',
  ADD COLUMN `emisor_giro`                VARCHAR(200) DEFAULT NULL COMMENT 'Giro declarado ante el SII',
  ADD COLUMN `emisor_direccion`           VARCHAR(200) DEFAULT NULL COMMENT 'Dirección de origen del emisor',
  ADD COLUMN `emisor_comuna`              VARCHAR(100) DEFAULT NULL COMMENT 'Comuna de origen del emisor',
  ADD COLUMN `emisor_actividad_economica` VARCHAR(150) DEFAULT NULL COMMENT 'Actividad económica / código SII del emisor';
