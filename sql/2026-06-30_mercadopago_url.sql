-- ============================================================
-- Migración: URL de cobro Mercado Pago por proyecto
-- Base de datos: control_presupuesto_nc
-- Tabla: proyectos
-- ============================================================

ALTER TABLE `proyectos`
  ADD COLUMN `url_cobro_mercadopago` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL
    COMMENT 'Link de cobro Mercado Pago para compartir al cliente';
