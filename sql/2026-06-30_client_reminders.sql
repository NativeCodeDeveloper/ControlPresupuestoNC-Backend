-- ============================================================
-- Migración: Recordatorios automáticos al cliente
-- Base de datos: control_presupuesto_nc
-- Tabla: proyectos
--
-- Cada columna almacena el valor de fecha_proximo_pago en el
-- momento en que se envió el recordatorio. Cuando el ciclo
-- avanza (fecha_proximo_pago cambia), la columna ya no coincide
-- y el sistema vuelve a enviar para el nuevo período.
-- ============================================================

ALTER TABLE `proyectos`
  ADD COLUMN `rem_cliente_previo`      DATE DEFAULT NULL COMMENT 'Recordatorio al cliente: 2 días antes del vencimiento',
  ADD COLUMN `rem_cliente_vencimiento` DATE DEFAULT NULL COMMENT 'Recordatorio al cliente: día del vencimiento',
  ADD COLUMN `rem_cliente_postuno`     DATE DEFAULT NULL COMMENT 'Recordatorio al cliente: 1 día post vencimiento (pago pendiente)',
  ADD COLUMN `rem_cliente_postres`     DATE DEFAULT NULL COMMENT 'Recordatorio al cliente: 3 días post vencimiento (aviso de suspensión)';
