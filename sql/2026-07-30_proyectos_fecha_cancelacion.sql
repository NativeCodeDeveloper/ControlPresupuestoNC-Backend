-- Registra cuándo un proyecto pasa a estado Cancelado (id 6), para que el Churn
-- Rate en MetricasNegocio.js se pueda calcular por período en vez de ser solo un
-- snapshot del estado actual. Deliberadamente NO se registra para Desactivada (id 9)
-- -- eso indica un cliente en pausa, no una cancelación de negocio.
-- Aditivo, nullable, no destructivo -- seguro de aplicar en cualquier momento.
ALTER TABLE proyectos
    ADD COLUMN fecha_cancelacion DATETIME NULL;
