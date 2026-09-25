-- ─── QA Migration v2 — tipo_contexto + nombre_producto ──────────────────────

ALTER TABLE qa_versiones
    ADD COLUMN tipo_contexto  ENUM('Actualizacion','Integracion','Nuevo Producto')
                              NOT NULL DEFAULT 'Actualizacion'
                              AFTER nombre,
    ADD COLUMN nombre_producto VARCHAR(200) NULL
                              AFTER tipo_contexto;
