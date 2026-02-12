import DataBase from "../config/Database.js";

export default class Proyectos {
    constructor(
        id,
        codigo_interno,
        nombre,
        tipo_proyecto_id,
        estado_proyecto_id,
        nombre_cliente,
        rut_cliente,
        email_cliente,
        telefono_cliente,
        profesion_cliente,
        monto_acordado,
        monto_pagado,
        fecha_creacion,
        fecha_entrega,
        observaciones
    ) {
        this.id = id;
        this.codigo_interno = codigo_interno;
        this.nombre = nombre;
        this.tipo_proyecto_id = tipo_proyecto_id;
        this.estado_proyecto_id = estado_proyecto_id;
        this.nombre_cliente = nombre_cliente;
        this.rut_cliente = rut_cliente;
        this.email_cliente = email_cliente;
        this.telefono_cliente = telefono_cliente;
        this.profesion_cliente = profesion_cliente;
        this.monto_acordado = monto_acordado;
        this.monto_pagado = monto_pagado;
        this.fecha_creacion = fecha_creacion;
        this.fecha_entrega = fecha_entrega;
        this.observaciones = observaciones;
    }

    // OBTENER TODOS LOS PROYECTOS
    async selectAllProyectos() {
        const conexion = DataBase.getInstance();
        const query = `SELECT p.*, tp.nombre as tipo_nombre, ep.nombre as estado_nombre 
                       FROM proyectos p
                       LEFT JOIN tipos_proyectos tp ON p.tipo_proyecto_id = tp.id
                       LEFT JOIN estados_proyectos ep ON p.estado_proyecto_id = ep.id
                       ORDER BY p.fecha_creacion DESC`;
        try {
            const resultado = await conexion.ejecutarQuery(query, []);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener proyectos de la base de datos');
        }
    }

    // OBTENER PROYECTO POR ID
    async selectProyectoById(id) {
        const conexion = DataBase.getInstance();
        const query = `SELECT p.*, tp.nombre as tipo_nombre, ep.nombre as estado_nombre 
                       FROM proyectos p
                       LEFT JOIN tipos_proyectos tp ON p.tipo_proyecto_id = tp.id
                       LEFT JOIN estados_proyectos ep ON p.estado_proyecto_id = ep.id
                       WHERE p.id = ?`;
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            throw new Error('Error al obtener proyecto de la base de datos');
        }
    }

    // CREAR NUEVO PROYECTO
    async insertProyecto(codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, fecha_entrega, observaciones) {
        const conexion = DataBase.getInstance();
        const query = `INSERT INTO proyectos 
                       (codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, 
                        email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, fecha_entrega, observaciones)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const param = [codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, 
                      email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, fecha_entrega || null, observaciones];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            try {
                // Compatibilidad con versiones anteriores del esquema.
                const fallbackQuery = `INSERT INTO proyectos 
                                       (codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, 
                                        email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, observaciones)
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const fallbackParam = [codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente,
                    email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, observaciones];
                return await conexion.ejecutarQuery(fallbackQuery, fallbackParam);
            } catch (_) {
                throw new Error('Error al crear proyecto en la base de datos');
            }
        }
    }

    // ACTUALIZAR PROYECTO
    async updateProyecto(id, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_entrega, observaciones) {
        const conexion = DataBase.getInstance();
        const query = `UPDATE proyectos SET nombre = ?, tipo_proyecto_id = ?, estado_proyecto_id = ?, 
                       nombre_cliente = ?, rut_cliente = ?, email_cliente = ?, telefono_cliente = ?, 
                       profesion_cliente = ?, monto_acordado = ?, fecha_entrega = ?, observaciones = ? 
                       WHERE id = ?`;
        const param = [nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, email_cliente, 
                      telefono_cliente, profesion_cliente, monto_acordado, fecha_entrega, observaciones, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al actualizar proyecto en la base de datos');
        }
    }

    // CAMBIAR ESTADO DEL PROYECTO
    async updateEstadoProyecto(id, estado_proyecto_id) {
        const conexion = DataBase.getInstance();
        const query = 'UPDATE proyectos SET estado_proyecto_id = ? WHERE id = ?';
        const param = [estado_proyecto_id, id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al cambiar estado del proyecto');
        }
    }

    // ELIMINAR PROYECTO
    async deleteProyecto(id) {
        const conexion = DataBase.getInstance();
        const query = 'DELETE FROM proyectos WHERE id = ?';
        const param = [id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            throw new Error('Error al eliminar proyecto de la base de datos');
        }
    }

    // OBTENER PAGOS DE UN PROYECTO
    async selectProyectoPagos(proyecto_id) {
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM proyecto_pagos WHERE proyecto_id = ? ORDER BY fecha_pago DESC';
        const param = [proyecto_id];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            throw new Error('Error al obtener pagos del proyecto');
        }
    }

    // REGISTRAR PAGO DE PROYECTO (y actualizar monto_pagado)
    async insertProyectoPago(proyecto_id, concepto, monto, fecha_pago, numero_comprobante, notas) {
        const conexion = DataBase.getInstance();
        const queryInsert = `INSERT INTO proyecto_pagos (proyecto_id, concepto, monto, fecha_pago, numero_comprobante, notas)
                       VALUES (?, ?, ?, ?, ?, ?)`;
        const paramInsert = [proyecto_id, concepto, monto, fecha_pago, numero_comprobante, notas];
        try {
            const resultado = await conexion.ejecutarQuery(queryInsert, paramInsert);

            // Actualizar monto_pagado en el proyecto
            const queryUpdate = `UPDATE proyectos SET monto_pagado = (
                SELECT COALESCE(SUM(monto), 0) FROM proyecto_pagos WHERE proyecto_id = ?
            ) WHERE id = ?`;
            await conexion.ejecutarQuery(queryUpdate, [proyecto_id, proyecto_id]);

            return resultado;
        } catch (error) {
            throw new Error('Error al registrar pago del proyecto');
        }
    }

    // GENERAR SIGUIENTE CODIGO INTERNO
    async getNextCodigoInterno(tipo_proyecto_id) {
        const conexion = DataBase.getInstance();
        try {
            const prefijos = {
                1: 'NCW',   // Web
                2: 'NCE',   // E-commerce
                3: 'NCS',   // SaaS
                4: 'NCL',   // Landing Page
                5: 'NCI',   // Inmobiliaria
                6: 'NCM'    // Marketing
            };
            const prefijo = prefijos[tipo_proyecto_id] || 'NCX';

            const query = `SELECT codigo_interno FROM proyectos
                          WHERE codigo_interno LIKE ?
                          ORDER BY codigo_interno DESC LIMIT 1`;
            const resultado = await conexion.ejecutarQuery(query, [`${prefijo}%`]);

            let nextNumber = 1;
            if (Array.isArray(resultado) && resultado.length > 0) {
                const lastCode = resultado[0].codigo_interno;
                const lastNumber = parseInt(lastCode.replace(prefijo, ''), 10);
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }

            return `${prefijo}${String(nextNumber).padStart(4, '0')}`;
        } catch (error) {
            throw new Error('Error al generar código interno');
        }
    }
}
