-- Migration: Rename generic id columns and add soft-delete support for finance domain
-- Safe to run once per environment. Tested for MySQL 8+ syntax.

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_proyectos_resumen;
DROP VIEW IF EXISTS v_gastos_por_mes;
DROP VIEW IF EXISTS v_saldos_fondos;

DROP PROCEDURE IF EXISTS sp_rename_column_if_exists;
DELIMITER //
CREATE PROCEDURE sp_rename_column_if_exists(
    IN p_table VARCHAR(128),
    IN p_old_col VARCHAR(128),
    IN p_new_col VARCHAR(128)
)
BEGIN
    DECLARE v_old_count INT DEFAULT 0;
    DECLARE v_new_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_old_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_old_col;

    SELECT COUNT(*) INTO v_new_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_new_col;

    IF v_old_count > 0 AND v_new_count = 0 THEN
        SET @sql_stmt = CONCAT(
            'ALTER TABLE `', p_table, '` RENAME COLUMN `', p_old_col, '` TO `', p_new_col, '`'
        );
        PREPARE stmt FROM @sql_stmt;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_add_column_if_missing;
DELIMITER //
CREATE PROCEDURE sp_add_column_if_missing(
    IN p_table VARCHAR(128),
    IN p_column VARCHAR(128),
    IN p_definition TEXT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column;

    IF v_count = 0 THEN
        SET @sql_stmt = CONCAT(
            'ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition
        );
        PREPARE stmt FROM @sql_stmt;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- Primary keys
CALL sp_rename_column_if_exists('configuracion_financiera', 'id', 'id_configuracion_financiera');
CALL sp_rename_column_if_exists('costos_fijos', 'id', 'id_costo_fijo');
CALL sp_rename_column_if_exists('costos_variables', 'id', 'id_costo_variable');
CALL sp_rename_column_if_exists('distribucion_mensual_socios', 'id', 'id_distribucion_mensual_socio');
CALL sp_rename_column_if_exists('estados_proyectos', 'id', 'id_estado_proyecto');
CALL sp_rename_column_if_exists('inversiones', 'id', 'id_inversion');
CALL sp_rename_column_if_exists('proyectos', 'id', 'id_proyecto');
CALL sp_rename_column_if_exists('proyecto_pagos', 'id', 'id_proyecto_pago');
CALL sp_rename_column_if_exists('resumen_mensual', 'id', 'id_resumen_mensual');
CALL sp_rename_column_if_exists('retiros_socios', 'id', 'id_retiro_socio');
CALL sp_rename_column_if_exists('servicios', 'id', 'id_servicio');
CALL sp_rename_column_if_exists('socios', 'id', 'id_socio');
CALL sp_rename_column_if_exists('tipos_costos_variables', 'id', 'id_tipo_costo_variable');
CALL sp_rename_column_if_exists('tipos_proyectos', 'id', 'id_tipo_proyecto');
CALL sp_rename_column_if_exists('transacciones', 'id', 'id_transaccion');

-- Foreign keys and explicit relation ids
CALL sp_rename_column_if_exists('costos_fijos', 'servicio_id', 'id_servicio');
CALL sp_rename_column_if_exists('costos_variables', 'tipo_costo_id', 'id_tipo_costo_variable');
CALL sp_rename_column_if_exists('costos_variables', 'proyecto_id', 'id_proyecto');
CALL sp_rename_column_if_exists('distribucion_mensual_socios', 'socio_id', 'id_socio');
CALL sp_rename_column_if_exists('proyectos', 'tipo_proyecto_id', 'id_tipo_proyecto');
CALL sp_rename_column_if_exists('proyectos', 'estado_proyecto_id', 'id_estado_proyecto');
CALL sp_rename_column_if_exists('proyecto_pagos', 'proyecto_id', 'id_proyecto');
CALL sp_rename_column_if_exists('retiros_socios', 'socio_id', 'id_socio');
CALL sp_rename_column_if_exists('transacciones', 'proyecto_id', 'id_proyecto');
CALL sp_rename_column_if_exists('transacciones', 'socio_id', 'id_socio');
CALL sp_rename_column_if_exists('transacciones', 'costo_fijo_id', 'id_costo_fijo');
CALL sp_rename_column_if_exists('transacciones', 'costo_variable_id', 'id_costo_variable');
CALL sp_rename_column_if_exists('transacciones', 'usuario_id', 'id_usuario');

-- Soft delete columns (finance domain)
CALL sp_add_column_if_missing('socios', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('socios', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('servicios', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('servicios', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('tipos_proyectos', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('tipos_proyectos', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('estados_proyectos', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('estados_proyectos', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('tipos_costos_variables', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('tipos_costos_variables', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('proyectos', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('proyectos', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('costos_variables', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('costos_variables', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('costos_fijos', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('costos_fijos', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('retiros_socios', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('retiros_socios', 'eliminado_en', 'DATETIME NULL');

CALL sp_add_column_if_missing('inversiones', 'activo', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_add_column_if_missing('inversiones', 'eliminado_en', 'DATETIME NULL');

-- Backfill rows previously soft-deleted via marker prefix
UPDATE socios SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE nombre LIKE '[ELIMINADO]#%';
UPDATE servicios SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE descripcion LIKE '[ELIMINADO]#%';
UPDATE tipos_proyectos SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE descripcion LIKE '[ELIMINADO]#%';
UPDATE estados_proyectos SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE descripcion LIKE '[ELIMINADO]#%';
UPDATE tipos_costos_variables SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE descripcion LIKE '[ELIMINADO]#%';
UPDATE proyectos SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE observaciones LIKE '[ELIMINADO]#%';
UPDATE costos_variables SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE observaciones LIKE '[ELIMINADO]#%';
UPDATE costos_fijos SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE notas LIKE '[ELIMINADO]#%';
UPDATE retiros_socios SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE observaciones LIKE '[ELIMINADO]#%';
UPDATE inversiones SET activo = 0, eliminado_en = COALESCE(eliminado_en, NOW()) WHERE observaciones LIKE '[ELIMINADO]#%';

-- Recreate views with renamed PK/FK columns
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW v_gastos_por_mes AS
SELECT YEAR(cf.fecha_inicio) AS año,
       MONTH(cf.fecha_inicio) AS mes,
       'Fijo' AS tipo_gasto,
       COUNT(*) AS cantidad,
       SUM(CASE WHEN cf.fecha_fin IS NULL OR cf.fecha_fin >= CURDATE() THEN cf.monto ELSE 0 END) AS monto_activo
FROM costos_fijos cf
GROUP BY YEAR(cf.fecha_inicio), MONTH(cf.fecha_inicio)
UNION ALL
SELECT YEAR(cv.fecha) AS año,
       MONTH(cv.fecha) AS mes,
       'Variable' AS tipo_gasto,
       COUNT(*) AS cantidad,
       SUM(cv.monto) AS monto_activo
FROM costos_variables cv
GROUP BY YEAR(cv.fecha), MONTH(cv.fecha);

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW v_proyectos_resumen AS
SELECT p.id_proyecto AS id,
       p.codigo_interno AS codigo_interno,
       p.nombre AS nombre,
       tp.nombre AS tipo,
       ep.nombre AS estado,
       p.nombre_cliente AS nombre_cliente,
       p.monto_acordado AS monto_acordado,
       COALESCE(SUM(pp.monto), 0) AS total_pagado,
       p.monto_acordado - COALESCE(SUM(pp.monto), 0) AS pendiente,
       ROUND(COALESCE(SUM(pp.monto), 0) / p.monto_acordado * 100, 2) AS porcentaje_completado,
       COUNT(pp.id_proyecto_pago) AS cantidad_pagos,
       p.fecha_creacion AS fecha_creacion,
       MAX(pp.fecha_pago) AS ultimo_pago
FROM proyectos p
LEFT JOIN proyecto_pagos pp ON p.id_proyecto = pp.id_proyecto
LEFT JOIN tipos_proyectos tp ON p.id_tipo_proyecto = tp.id_tipo_proyecto
LEFT JOIN estados_proyectos ep ON p.id_estado_proyecto = ep.id_estado_proyecto
GROUP BY p.id_proyecto
ORDER BY p.fecha_creacion DESC;

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW v_saldos_fondos AS
SELECT 'reinversion' AS fondo,
       COALESCE((SELECT SUM(rm.deduccion_reinversion) FROM resumen_mensual rm), 0) AS total_asignado,
       COALESCE((SELECT SUM(i.monto) FROM inversiones i WHERE i.fondo_origen = 'reinversion'), 0) AS total_usado,
       COALESCE((SELECT SUM(rm.deduccion_reinversion) FROM resumen_mensual rm), 0)
       - COALESCE((SELECT SUM(i.monto) FROM inversiones i WHERE i.fondo_origen = 'reinversion'), 0) AS saldo_disponible
UNION ALL
SELECT 'emergencia' AS fondo,
       COALESCE((SELECT SUM(rm.deduccion_fondo_emergencia) FROM resumen_mensual rm), 0) AS total_asignado,
       COALESCE((SELECT SUM(i.monto) FROM inversiones i WHERE i.fondo_origen = 'emergencia'), 0) AS total_usado,
       COALESCE((SELECT SUM(rm.deduccion_fondo_emergencia) FROM resumen_mensual rm), 0)
       - COALESCE((SELECT SUM(i.monto) FROM inversiones i WHERE i.fondo_origen = 'emergencia'), 0) AS saldo_disponible;

DROP PROCEDURE IF EXISTS sp_rename_column_if_exists;
DROP PROCEDURE IF EXISTS sp_add_column_if_missing;

SET FOREIGN_KEY_CHECKS = 1;
