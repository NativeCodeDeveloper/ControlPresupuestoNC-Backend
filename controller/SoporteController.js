import * as Soporte from '../model/SoporteTickets.js';
import { enviarApertura, enviarActualizacion, enviarCierre,
         templateApertura, templateActualizacion, templateCierre } from '../services/soporteEmailService.js';
import { emitUpdate } from '../config/socket.js';
import { sendPushToAll } from '../services/pushService.js';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

export default class SoporteController {

    // ─── Estados ─────────────────────────────────────────────────────────────

    static async listarEstados(_req, res) {
        try {
            const estados = await Soporte.getEstados();
            res.json(estados);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener estados' });
        }
    }

    // ─── Tickets ──────────────────────────────────────────────────────────────

    static async listar(req, res) {
        try {
            const tickets = await Soporte.getTickets(req.query);
            res.json(tickets);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener tickets' });
        }
    }

    static async obtener(req, res) {
        try {
            const ticket = await Soporte.getTicketById(req.params.id);
            if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });
            res.json(ticket);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener ticket' });
        }
    }

    static async crear(req, res) {
        try {
            const { id_proyecto, nombre_cliente, email_cliente, asunto, descripcion,
                    prioridad, sla_horas, id_estado, id_responsable } = req.body;

            if (!nombre_cliente || !email_cliente || !asunto || !descripcion || !id_estado) {
                return res.status(400).json({ message: 'Faltan campos requeridos' });
            }

            const { id_ticket, numero_ticket } = await Soporte.createTicket({
                id_proyecto, nombre_cliente, email_cliente, asunto, descripcion,
                prioridad, sla_horas, id_estado, id_responsable
            });

            const ticket = await Soporte.getTicketById(id_ticket);

            await Soporte.addActividad({
                id_ticket,
                tipo: 'creacion',
                contenido: `Ticket creado con prioridad ${prioridad ?? 'media'}`,
                id_socio: req.body.id_socio ?? null
            });

            // Enviar email de apertura automático si el template no se omite
            if (email_cliente && req.body.enviar_apertura !== false) {
                const { ok } = await enviarApertura({ ticket, bodyText: req.body.body_apertura });
                if (ok) {
                    await Soporte.addActividad({ id_ticket, tipo: 'notificacion', contenido: 'Email de apertura enviado al cliente' });
                }
            }

            // Notificación interna — nuevo ticket
            await db().ejecutarQuery(
                `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, NOW(), 'ticket_nuevo')`,
                [`Nuevo ticket: ${numero_ticket}`, `${nombre_cliente} — ${asunto}`]
            );
            emitUpdate('ncf:update');
            sendPushToAll(`Nuevo ticket: ${numero_ticket}`, `${nombre_cliente} — ${asunto}`, '/nexus').catch(() => {});

            res.status(201).json({ ok: true, id_ticket, numero_ticket, ticket });
        } catch (e) {
            console.error('[SoporteController.crear]', e.message);
            res.status(500).json({ message: 'Error al crear ticket' });
        }
    }

    static async actualizar(req, res) {
        try {
            const id = req.params.id;
            const ticket = await Soporte.getTicketById(id);
            if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

            const { id_estado, id_responsable, prioridad, sla_horas,
                    resolucion_causa, resolucion_accion, resolucion_resultado, resolucion_observaciones } = req.body;

            // Detectar cambio de estado para historial
            const estadoAnterior = ticket.estado_nombre;
            let estadoNuevo = estadoAnterior;

            if (id_estado && id_estado !== ticket.id_estado) {
                const nuevoEst = await Soporte.getEstadoById(id_estado);
                estadoNuevo = nuevoEst?.nombre ?? estadoAnterior;

                await Soporte.addActividad({
                    id_ticket: id, tipo: 'cambio_estado',
                    contenido: `Estado: ${estadoAnterior} → ${estadoNuevo}`,
                    estado_anterior: estadoAnterior, estado_nuevo: estadoNuevo,
                    id_socio: req.body.id_socio ?? null
                });

                // Notificación interna — cambio de estado
                await db().ejecutarQuery(
                    `INSERT INTO notificaciones_inapp (titulo, descripcion, fecha_evento, tipo) VALUES (?, ?, NOW(), 'ticket_estado')`,
                    [`${ticket.numero_ticket} → ${estadoNuevo}`, `${ticket.asunto} · ${ticket.nombre_cliente}`]
                );
                emitUpdate('ncf:update');
                sendPushToAll(`${ticket.numero_ticket} → ${estadoNuevo}`, `${ticket.asunto} · ${ticket.nombre_cliente}`, '/nexus').catch(() => {});

                // Si es estado de cierre, marcar cerrado_en
                if (nuevoEst?.es_cierre) {
                    req.body.cerrado_en = new Date().toISOString().slice(0, 19).replace('T', ' ');
                }
            }

            if (resolucion_causa || resolucion_accion || resolucion_resultado || resolucion_observaciones) {
                const detalle = [
                    resolucion_causa     && `Causa: ${resolucion_causa}`,
                    resolucion_accion    && `Acción: ${resolucion_accion}`,
                    resolucion_resultado && `Resultado: ${resolucion_resultado}`,
                    resolucion_observaciones && `Obs: ${resolucion_observaciones}`,
                ].filter(Boolean).join('\n');

                await Soporte.addActividad({
                    id_ticket: id, tipo: 'resolucion',
                    contenido: detalle || 'Resolución registrada',
                    id_socio: req.body.id_socio ?? null
                });
            }

            await Soporte.updateTicket(id, {
                id_estado, id_responsable, prioridad, sla_horas,
                resolucion_causa, resolucion_accion, resolucion_resultado, resolucion_observaciones,
                cerrado_en: req.body.cerrado_en ?? undefined
            });

            const ticketActualizado = await Soporte.getTicketById(id);
            res.json({ ok: true, ticket: ticketActualizado });
        } catch (e) {
            console.error('[SoporteController.actualizar]', e.message);
            res.status(500).json({ message: 'Error al actualizar ticket' });
        }
    }

    static async eliminar(req, res) {
        try {
            await Soporte.deleteTicket(req.params.id);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ message: 'Error al eliminar ticket' });
        }
    }

    // ─── Actividad interna ────────────────────────────────────────────────────

    static async listarActividad(req, res) {
        try {
            const actividad = await Soporte.getActividad(req.params.id);
            res.json(actividad);
        } catch (e) {
            res.status(500).json({ message: 'Error al obtener actividad' });
        }
    }

    static async agregarComentario(req, res) {
        try {
            const id = req.params.id;
            const { contenido, id_socio } = req.body;
            if (!contenido) return res.status(400).json({ message: 'Contenido requerido' });

            await Soporte.addActividad({ id_ticket: id, tipo: 'comentario', contenido, id_socio });
            const actividad = await Soporte.getActividad(id);
            res.json({ ok: true, actividad });
        } catch (e) {
            res.status(500).json({ message: 'Error al agregar comentario' });
        }
    }

    // ─── Emails ───────────────────────────────────────────────────────────────

    // GET /api/soporte/:id/email/preview?tipo=apertura|actualizacion|cierre
    static async previewEmail(req, res) {
        try {
            const ticket = await Soporte.getTicketById(req.params.id);
            if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

            const tipo = req.query.tipo ?? 'apertura';
            let template;
            if (tipo === 'cierre') {
                template = templateCierre({
                    ticket,
                    resolucion: {
                        causa:         ticket.resolucion_causa,
                        accion:        ticket.resolucion_accion,
                        resultado:     ticket.resolucion_resultado,
                        observaciones: ticket.resolucion_observaciones,
                    }
                });
            } else if (tipo === 'actualizacion') {
                template = templateActualizacion({ ticket, nuevoEstado: ticket.estado_nombre });
            } else {
                template = templateApertura({ ticket });
            }

            res.json({ subject: template.subject, body: template.body });
        } catch (e) {
            res.status(500).json({ message: 'Error generando preview' });
        }
    }

    // ─── CRUD Estados ─────────────────────────────────────────────────────────

    static async crearEstado(req, res) {
        try {
            const { nombre, color_hex, es_cierre } = req.body;
            if (!nombre?.trim()) return res.status(400).json({ message: 'Nombre requerido' });
            await Soporte.createEstado({ nombre: nombre.trim(), color_hex: color_hex ?? '#6b7280', es_cierre: es_cierre ? 1 : 0 });
            const estados = await Soporte.getEstados();
            res.status(201).json({ ok: true, estados });
        } catch (e) {
            res.status(500).json({ message: 'Error al crear estado' });
        }
    }

    static async eliminarEstado(req, res) {
        try {
            await Soporte.deleteEstado(req.params.id);
            const estados = await Soporte.getEstados();
            res.json({ ok: true, estados });
        } catch (e) {
            res.status(500).json({ message: 'Error al eliminar estado' });
        }
    }

    // POST /api/soporte/:id/email/enviar  { tipo, body_text, id_socio }
    static async enviarEmail(req, res) {
        try {
            const ticket = await Soporte.getTicketById(req.params.id);
            if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

            const { tipo, body_text, id_socio } = req.body;
            let result;

            if (tipo === 'cierre') {
                result = await enviarCierre({
                    ticket,
                    resolucion: {
                        causa:         ticket.resolucion_causa,
                        accion:        ticket.resolucion_accion,
                        resultado:     ticket.resolucion_resultado,
                        observaciones: ticket.resolucion_observaciones,
                    },
                    bodyText: body_text,
                });
                if (result.ok) {
                    await Soporte.addActividad({ id_ticket: ticket.id_ticket, tipo: 'cierre', contenido: 'Email de cierre enviado al cliente', id_socio });
                }
            } else if (tipo === 'actualizacion') {
                result = await enviarActualizacion({ ticket, nuevoEstado: ticket.estado_nombre, bodyText: body_text });
                if (result.ok) {
                    await Soporte.addActividad({ id_ticket: ticket.id_ticket, tipo: 'notificacion', contenido: 'Email de actualización enviado al cliente', id_socio });
                }
            } else {
                result = await enviarApertura({ ticket, bodyText: body_text });
                if (result.ok) {
                    await Soporte.addActividad({ id_ticket: ticket.id_ticket, tipo: 'notificacion', contenido: 'Email de apertura re-enviado al cliente', id_socio });
                }
            }

            res.json({ ok: result.ok });
        } catch (e) {
            console.error('[SoporteController.enviarEmail]', e.message);
            res.status(500).json({ message: 'Error al enviar email' });
        }
    }
}
