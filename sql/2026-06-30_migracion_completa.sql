-- ============================================================
-- NativeCode Finance — Migración completa
-- Base de datos: control_presupuesto_nc
-- Tabla: proyectos
--
-- Ejecutar este script completo en phpMyAdmin.
-- Usa procedimientos almacenados para evitar errores
-- si alguna columna ya existe en el servidor.
-- ============================================================

DROP PROCEDURE IF EXISTS nc_add_column_safe;

DELIMITER $$

CREATE PROCEDURE nc_add_column_safe(
    IN p_table  VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_def    TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND COLUMN_NAME  = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Columna agregada: ', p_column) AS resultado;
    ELSE
        SELECT CONCAT('⏭ Ya existía: ', p_column) AS resultado;
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- BLOQUE 1: Recordatorios internos de cobro (equipo NativeCode)
-- Usados por billingReminderService.js
-- ============================================================

CALL nc_add_column_safe('proyectos', 'rem_aviso',
    '`rem_aviso` DATE DEFAULT NULL COMMENT "Recordatorio interno: 5 días antes del vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_urgente',
    '`rem_urgente` DATE DEFAULT NULL COMMENT "Recordatorio interno: 1 día antes del vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_vencimiento',
    '`rem_vencimiento` DATE DEFAULT NULL COMMENT "Recordatorio interno: día del vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_seguimiento',
    '`rem_seguimiento` DATE DEFAULT NULL COMMENT "Recordatorio interno: 3 días post vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_escalacion',
    '`rem_escalacion` DATE DEFAULT NULL COMMENT "Recordatorio interno: 7 días post vencimiento (escalación)"');

-- ============================================================
-- BLOQUE 2: Recordatorios al cliente
-- Usados por clientReminderService.js
-- ============================================================

CALL nc_add_column_safe('proyectos', 'rem_cliente_previo',
    '`rem_cliente_previo` DATE DEFAULT NULL COMMENT "Recordatorio al cliente: 2 días antes del vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_cliente_vencimiento',
    '`rem_cliente_vencimiento` DATE DEFAULT NULL COMMENT "Recordatorio al cliente: día del vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_cliente_postuno',
    '`rem_cliente_postuno` DATE DEFAULT NULL COMMENT "Recordatorio al cliente: 1 día post vencimiento"');

CALL nc_add_column_safe('proyectos', 'rem_cliente_postres',
    '`rem_cliente_postres` DATE DEFAULT NULL COMMENT "Recordatorio al cliente: 3 días post vencimiento (aviso suspensión)"');

-- ============================================================
-- BLOQUE 3: URL de cobro Mercado Pago
-- ============================================================

CALL nc_add_column_safe('proyectos', 'url_cobro_mercadopago',
    '`url_cobro_mercadopago` VARCHAR(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT "Link de cobro Mercado Pago para compartir al cliente"');

-- ============================================================
-- Limpieza
-- ============================================================

DROP PROCEDURE IF EXISTS nc_add_column_safe;

SELECT '✅ Migración completa finalizada.' AS estado;
