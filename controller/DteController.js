import Proyectos from '../model/Proyectos.js';
import ConfiguracionFinanciera from '../model/ConfiguracionFinanciera.js';
import * as dteService from '../services/dteService.js';

const AMBIENTE = process.env.DTE_AMBIENTE === 'produccion' ? 'produccion' : 'certificacion';

async function construirEmisorReceptor(idProyecto) {
    const proyecto = new Proyectos();
    const datosProyecto = await proyecto.selectProyectoById(idProyecto);
    if (!datosProyecto) return { error: 'Proyecto no encontrado' };

    const configFinanciera = new ConfiguracionFinanciera();
    const config = await configFinanciera.selectConfig();
    if (!config?.emisor_rut || !config?.emisor_razon_social) {
        return { error: 'Faltan datos del emisor (Config → Datos del Emisor)' };
    }

    const emisor = {
        rut: config.emisor_rut,
        razonSocial: config.emisor_razon_social,
        giro: config.emisor_giro,
        direccion: config.emisor_direccion,
        comuna: config.emisor_comuna,
        acteco: config.emisor_actividad_economica,
    };
    const receptor = {
        rut: datosProyecto.rut_cliente || null,
        nombre: datosProyecto.nombre_cliente,
        giro: datosProyecto.profesion_cliente,
        direccion: datosProyecto.direccion_cliente,
        comuna: datosProyecto.comuna_cliente,
    };
    return { emisor, receptor, proyecto: datosProyecto };
}

export default class DteController {
    /** POST /api/dte/emitir/:id_proyecto */
    static async emitir(req, res) {
        try {
            const { id_proyecto } = req.params;
            const { detalle, tipoDte: tipoDteBody, fechaVencimiento, id_pago } = req.body;

            const { error, emisor, receptor, proyecto } = await construirEmisorReceptor(id_proyecto);
            if (error) return res.status(400).json({ message: error });

            const tipoDte = tipoDteBody || (receptor.rut ? 33 : 39);
            const detalleLineas = Array.isArray(detalle) && detalle.length
                ? detalle
                : [{ nombre: proyecto.nombre, cantidad: 1, precioUnitario: Math.round(parseFloat(proyecto.monto_acordado || 0)) }];

            const estadoCaf = await dteService.obtenerEstadoCaf(AMBIENTE);
            const cafDisponible = tipoDte === 33 ? estadoCaf.factura33 : estadoCaf.boleta39;
            if (!cafDisponible) {
                return res.status(409).json({ message: `No hay CAF cargado para tipo ${tipoDte} en ambiente ${AMBIENTE}` });
            }

            const resultado = await dteService.emitirDte({
                idProyecto: Number(id_proyecto),
                idPago: id_pago ? Number(id_pago) : null,
                tipoDte,
                emisor,
                receptor,
                detalle: detalleLineas,
                fechaVencimiento: fechaVencimiento || null,
                ambiente: AMBIENTE,
                emitidoPor: req.auth?.userId || null,
            });

            return res.status(resultado.ok ? 201 : 502).json(resultado);
        } catch (error) {
            console.error('[DteController.emitir]', error);
            return res.status(500).json({ message: 'Error al emitir el documento tributario', detalle: error.message });
        }
    }

    /** GET /api/dte/proyecto/:id_proyecto */
    static async historial(req, res) {
        try {
            const historial = await dteService.obtenerHistorialProyecto(req.params.id_proyecto);
            return res.json(historial);
        } catch (error) {
            console.error('[DteController.historial]', error);
            return res.status(500).json({ message: 'Error al obtener el historial de documentos' });
        }
    }

    /** GET /api/dte/proyecto/:id_proyecto/ultimo — para "similar al último" */
    static async ultimoDocumento(req, res) {
        try {
            const ultimo = await dteService.obtenerUltimoDocumento(req.params.id_proyecto);
            return res.json(ultimo);
        } catch (error) {
            console.error('[DteController.ultimoDocumento]', error);
            return res.status(500).json({ message: 'Error al obtener el último documento' });
        }
    }

    /** GET /api/dte/estado — informa si hay CAF cargado, para habilitar/deshabilitar "Emitir DTE" en el frontend */
    static async estado(req, res) {
        try {
            const estado = await dteService.obtenerEstadoCaf(AMBIENTE);
            return res.json({ ambiente: AMBIENTE, ...estado });
        } catch (error) {
            console.error('[DteController.estado]', error);
            return res.status(500).json({ message: 'Error al consultar el estado del CAF' });
        }
    }
}
