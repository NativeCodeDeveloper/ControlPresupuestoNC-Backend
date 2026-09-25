-- ============================================================
-- Migración: Campo api_key_encrypted en synapse_servidores
-- Propósito: Almacenar API keys de Agenda Clínica cifradas
-- Seguridad: AES-256-GCM, clave maestra en .env
-- Fecha: 2026-08-03
-- ============================================================
--
-- INSTRUCCIONES:
-- 1. Generar clave maestra: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
-- 2. Agregar a .env: ENCRYPTION_KEY=<clave_generada_de_64_caracteres_hex>
-- 3. Ejecutar esta migración
-- 4. NUNCA hacer commit de ENCRYPTION_KEY al repo
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

-- Agregar campo api_key_encrypted
CALL nc_add_column_safe('synapse_servidores', 'api_key_encrypted',
    '`api_key_encrypted` VARCHAR(500) NULL COMMENT "API Key de Agenda Clínica cifrada (AES-256-GCM)"');

-- Limpieza
DROP PROCEDURE IF EXISTS nc_add_column_safe;

SELECT '✅ Migración finalizada: api_key_encrypted agregado a synapse_servidores' AS estado;

-- ============================================================
-- NOTAS DE SEGURIDAD:
-- ============================================================
--
-- La API key se cifra ANTES de guardar en BD usando:
-- - AES-256-GCM (autenticado)
-- - Clave derivada con PBKDF2 (100k iteraciones)
-- - Salt único por cifrado
--
-- Al desencriptar:
-- - Solo se desencripta en memoria (no se guarda en log)
-- - Si falla el desencriptado, se asume manipulación
--
-- La clave maestra (ENCRYPTION_KEY) debe:
-- - Estar en .env del backend (NUNCA committing)
-- - Ser hexadecimal de 64 caracteres (32 bytes)
-- - Rotarse si se ve comprometida
-- ============================================================
