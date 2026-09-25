-- Synapse: ocultar columnas (estados) por equipo.
--
-- Los estados del kanban son globales, así que hoy todos los equipos ven las mismas
-- columnas. Esta tabla guarda, por equipo, qué columnas NO se muestran.
--
-- Se guarda lo OCULTO y no lo visible a propósito: con la tabla vacía el
-- comportamiento es idéntico al actual (todos los equipos ven todos los estados
-- activos), así que aplicar esta migración no cambia nada en producción. Además,
-- un estado nuevo aparece por defecto en todos los equipos, que es lo esperable.
--
-- Aditiva: no toca ninguna tabla existente. Los ON DELETE CASCADE evitan filas
-- huérfanas si se borra un equipo o un estado.
CREATE TABLE IF NOT EXISTS `synapse_team_estados_ocultos` (
  `id_team`   int NOT NULL,
  `id_estado` int NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_team`, `id_estado`),
  KEY `idx_stbo_estado` (`id_estado`),
  CONSTRAINT `fk_stbo_team`   FOREIGN KEY (`id_team`)   REFERENCES `synapse_teams`   (`id_team`)   ON DELETE CASCADE,
  CONSTRAINT `fk_stbo_estado` FOREIGN KEY (`id_estado`) REFERENCES `synapse_estados` (`id_estado`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
