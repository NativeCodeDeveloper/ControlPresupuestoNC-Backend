import * as Cliente from '../model/ClienteModel.js';

export default class ClienteController {

    static async listar(req, res) {
        try {
            return res.json(await Cliente.getClientes() ?? []);
        } catch (e) {
            console.error('[Cliente.listar]', e.message);
            return res.status(500).json({ message: 'Error al obtener clientes' });
        }
    }

    static async proyectos(req, res) {
        try {
            const nombre = decodeURIComponent(req.params.nombre);
            return res.json(await Cliente.getClienteProyectos(nombre) ?? []);
        } catch (e) {
            console.error('[Cliente.proyectos]', e.message);
            return res.status(500).json({ message: 'Error al obtener proyectos del cliente' });
        }
    }
}
