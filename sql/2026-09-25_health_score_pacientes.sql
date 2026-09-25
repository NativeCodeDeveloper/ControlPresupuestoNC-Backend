-- Health Score: métrica de pacientes registrados.
--
-- Señal más directa que las fichas clínicas: registrar un paciente significa
-- que el profesional está atendiendo gente de verdad, no solo llenando la
-- agenda. Una clínica puede tener muchas reservas y pocos pacientes; lo
-- contrario casi no ocurre.
--
-- Aditiva: columnas nuevas nullable. Las filas existentes quedan en NULL, que
-- el score interpreta como "no medible" y no penaliza.
ALTER TABLE `health_score_uso_cache`
    ADD COLUMN `pacientes` int DEFAULT NULL COMMENT 'Acumulado de pacientes registrados';

ALTER TABLE `health_score_uso_serie`
    ADD COLUMN `pacientes` int DEFAULT NULL COMMENT 'Acumulado informado por el cliente';
