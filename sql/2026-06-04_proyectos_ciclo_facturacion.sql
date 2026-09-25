-- =============================================================
-- MIGRACIÓN: 2026-06-04 — Ciclo de facturación en proyectos
--             y fecha de último pago en costos fijos
-- =============================================================
-- Segura: solo agrega columnas con DEFAULT, no rompe datos existentes.
-- Aplicar en producción ANTES de desplegar la versión de backend/frontend
-- que usa estas columnas.
-- =============================================================

-- ----------------------------------------------------------------
-- 1. proyectos — control de ciclo de facturación recurrente
-- ----------------------------------------------------------------
-- ciclo_facturacion : tipo de ciclo del proyecto
--   'Unico'      → pago único (comportamiento actual — default)
--   'Mensual'    → se factura cada mes
--   'Trimestral' → se factura cada 3 meses
--   'Anual'      → se factura una vez al año
--
-- fecha_inicio_servicio : cuándo empieza el servicio contratado
--   Base para calcular fecha_proximo_pago automáticamente.
--   NULL = proyecto de pago único o sin ciclo definido.
--
-- fecha_proximo_pago : próxima fecha de cobro esperada
--   Se actualiza automáticamente al registrar un pago.
--   NULL = no aplica o aún no calculado.
-- ----------------------------------------------------------------

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS ciclo_facturacion       ENUM('Unico','Mensual','Trimestral','Anual') NOT NULL DEFAULT 'Unico'  AFTER fecha_entrega,
  ADD COLUMN IF NOT EXISTS fecha_inicio_servicio   DATE                                         DEFAULT NULL             AFTER ciclo_facturacion,
  ADD COLUMN IF NOT EXISTS fecha_proximo_pago      DATE                                         DEFAULT NULL             AFTER fecha_inicio_servicio;

-- ----------------------------------------------------------------
-- 2. costos_fijos — registro de cuándo se pagó por última vez
-- ----------------------------------------------------------------
-- fecha_ultimo_pago : fecha en que se marcó el costo como pagado.
--   NULL = nunca se ha registrado un pago → usa fecha_inicio para
--   calcular el próximo vencimiento (lógica existente conservada).
--   Con valor → computeNextFixedDueDate parte de este campo
--   en lugar de iterar desde fecha_inicio.
-- ----------------------------------------------------------------

ALTER TABLE costos_fijos
  ADD COLUMN IF NOT EXISTS fecha_ultimo_pago DATE DEFAULT NULL AFTER fecha_fin;

-- ----------------------------------------------------------------
-- Verificación rápida (comentar en producción si se prefiere)
-- ----------------------------------------------------------------
-- SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
-- FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('proyectos', 'costos_fijos')
--   AND COLUMN_NAME IN ('ciclo_facturacion','fecha_inicio_servicio','fecha_proximo_pago','fecha_ultimo_pago')
-- ORDER BY TABLE_NAME, ORDINAL_POSITION;
