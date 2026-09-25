-- Permite categorizar un servicio (usado por costos_fijos) con el mismo catálogo
-- que ya usan los costos variables (tipos_costos_variables: Marketing=4, Publicidad=7).
-- Con esto, el CAC en MetricasNegocio.js puede sumar gasto de adquisición de clientes
-- sin importar si está cargado como costo fijo (ej. Meta Ads mensual) o variable.
-- Aditivo, nullable, no destructivo — seguro de aplicar en cualquier momento.
ALTER TABLE servicios
    ADD COLUMN tipo_costo_variable_id INT NULL,
    ADD CONSTRAINT fk_servicios_tipo_costo_variable
        FOREIGN KEY (tipo_costo_variable_id)
        REFERENCES tipos_costos_variables (id_tipo_costo_variable)
        ON DELETE SET NULL;

-- Backfill: el servicio "Meta Ads" ya existente se marca como Publicidad (7),
-- para que el CAC lo detecte de inmediato sin esperar a re-crearlo desde la UI.
UPDATE servicios SET tipo_costo_variable_id = 7 WHERE nombre = 'Meta Ads';
