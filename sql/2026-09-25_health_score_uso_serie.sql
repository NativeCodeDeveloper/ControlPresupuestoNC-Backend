-- Serie diaria de métricas de uso por cliente (Health Score).
--
-- Por qué existe: el endpoint /health-metrics de Agenda Clínica devuelve
-- contadores ACUMULADOS (cuántas reservas y fichas existen en total), porque
-- su base no guarda la fecha de creación de esas filas y agregarla habría
-- obligado a migrar 49 bases de clientes.
--
-- Un acumulado no sirve para medir salud: nunca baja. Una clínica con 5.000
-- reservas históricas que lleva dos meses sin agendar sigue marcando 5.000.
-- Guardando el acumulado de cada día, la actividad sale de la RESTA entre dos
-- fechas: reservas(hoy) - reservas(hace 30 días) = reservas del último mes.
--
-- health_score_uso_cache sigue guardando lo que consume el score (ya derivado);
-- esta tabla guarda el dato crudo del que se derivan, y es la que permite
-- calcular la tendencia semanal sin pedirle nada más a Agenda Clínica.
--
-- Aditiva: tabla nueva, no toca nada existente.
CREATE TABLE IF NOT EXISTS `health_score_uso_serie` (
  `nombre_cliente`  varchar(255) NOT NULL,
  `fecha`           date         NOT NULL,
  `reservas`        int          DEFAULT NULL COMMENT 'Acumulado total informado por el cliente',
  `fichas_clinicas` int          DEFAULT NULL COMMENT 'Acumulado total informado por el cliente',
  `confirmaciones`  int          DEFAULT NULL COMMENT '% de asistencia (ya es una tasa, no acumula)',
  `creado_en`       timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`nombre_cliente`, `fecha`),
  KEY `idx_uso_serie_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
