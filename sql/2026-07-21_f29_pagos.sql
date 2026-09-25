-- ─── Historial de pagos F29 (IVA mensual) ────────────────────────────────────
-- Guarda un snapshot del cálculo F29 al momento de marcar un período como
-- pagado, para poder mostrar un historial mes a mes con estado (pagado /
-- pendiente) sin depender de que el cálculo en vivo no cambie retroactivamente.

CREATE TABLE IF NOT EXISTS f29_pagos (
    id_pago           INT AUTO_INCREMENT PRIMARY KEY,
    mes               INT NOT NULL,
    anio              INT NOT NULL,
    iva_neto          DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_f29         DECIMAL(14,2) NOT NULL DEFAULT 0,
    debito_fiscal     DECIMAL(14,2) NOT NULL DEFAULT 0,
    credito_fiscal    DECIMAL(14,2) NOT NULL DEFAULT 0,
    fecha_vencimiento DATE NULL,
    pagado            TINYINT(1) NOT NULL DEFAULT 0,
    fecha_pago        DATE NULL,
    notas             TEXT NULL,
    creado_en         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_f29_periodo (anio, mes)
);
