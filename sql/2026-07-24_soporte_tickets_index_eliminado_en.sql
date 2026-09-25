-- Índice para soporte_tickets.eliminado_en: se filtra en TODA consulta de tickets
-- (getTickets, getTicketById) y hoy solo está cubierta por los índices automáticos
-- de las FK (id_estado, id_proyecto, id_responsable), no por esta columna.
-- Aditivo, no destructivo — seguro de aplicar en cualquier momento.
CREATE INDEX idx_soporte_tickets_eliminado_en ON soporte_tickets (eliminado_en);
