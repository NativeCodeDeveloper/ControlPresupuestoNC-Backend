import DataBase from "../config/Database.js";

const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
let proyectosColumnsCache = null;
let proyectosColumnsCachePromise = null;

const getProyectosColumns = async (conexion) => {
    if (proyectosColumnsCache) return proyectosColumnsCache;
    if (proyectosColumnsCachePromise) return proyectosColumnsCachePromise;
    proyectosColumnsCachePromise = (async () => {

    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'proyectos'`,
        []
    );

        proyectosColumnsCache = new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.COLUMN_NAME || "").trim())
                .filter(Boolean)
        );
        return proyectosColumnsCache;
    })();
    return proyectosColumnsCachePromise;
};

const hasProyectosColumn = async (conexion, columnName) => {
    const cols = await getProyectosColumns(conexion);
    return cols.has(columnName);
};

const getProyectoIdColumn = async (conexion) => (
    (await hasProyectosColumn(conexion, "id_proyecto")) ? "id_proyecto" : "id"
);

const getProyectoTipoColumn = async (conexion) => (
    (await hasProyectosColumn(conexion, "id_tipo_proyecto")) ? "id_tipo_proyecto" : "tipo_proyecto_id"
);

const getProyectoEstadoColumn = async (conexion) => (
    (await hasProyectosColumn(conexion, "id_estado_proyecto")) ? "id_estado_proyecto" : "estado_proyecto_id"
);

const getProyectoPagosColumns = async (conexion) => {
    const rows = await conexion.ejecutarQuery(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'proyecto_pagos'`,
        []
    );
    return new Set((Array.isArray(rows) ? rows : []).map((r) => String(r.COLUMN_NAME || "").trim()).filter(Boolean));
};

const getProyectoPagoIdColumn = async (conexion) => (
    (await getProyectoPagosColumns(conexion)).has("id_proyecto_pago") ? "id_proyecto_pago" : "id"
);

const getProyectoPagoFkColumn = async (conexion) => (
    (await getProyectoPagosColumns(conexion)).has("id_proyecto") ? "id_proyecto" : "proyecto_id"
);

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
    async selectAllProyectos(pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const hasObservaciones = await hasProyectosColumn(conexion, "observaciones");
            const idColumn = await getProyectoIdColumn(conexion);
            const tipoColumn = await getProyectoTipoColumn(conexion);
            const estadoColumn = await getProyectoEstadoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_proyecto" ? "id_tipo_proyecto" : "id";
            const estadoPkColumn = estadoColumn === "id_estado_proyecto" ? "id_estado_proyecto" : "id";
            const where = [];
            const params = [];

            if (hasActivo) {
                where.push("p.activo = 1");
            } else if (hasObservaciones) {
                where.push("(p.observaciones IS NULL OR p.observaciones NOT LIKE ?)");
                params.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
            let query = `SELECT p.*, p.${idColumn} AS id, p.${tipoColumn} AS tipo_proyecto_id, p.${estadoColumn} AS estado_proyecto_id,
                                  tp.nombre as tipo_nombre, ep.nombre as estado_nombre, ep.color_hex as estado_color
                           FROM proyectos p
                           LEFT JOIN tipos_proyectos tp ON p.${tipoColumn} = tp.${tipoPkColumn} AND tp.activo = 1
                           LEFT JOIN estados_proyectos ep ON p.${estadoColumn} = ep.${estadoPkColumn} AND ep.activo = 1
                           ${whereClause}
                           ORDER BY p.fecha_creacion DESC`;
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                params.push(Number(pagination.limit), Number(pagination.offset));
            }

            const resultado = await conexion.ejecutarQuery(query, params);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            console.error('[Proyectos.selectAllProyectos]', error);
            throw new Error('Error al obtener proyectos de la base de datos');
        }
    }

    // OBTENER PROYECTO POR ID
    async selectProyectoById(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const hasObservaciones = await hasProyectosColumn(conexion, "observaciones");
            const idColumn = await getProyectoIdColumn(conexion);
            const tipoColumn = await getProyectoTipoColumn(conexion);
            const estadoColumn = await getProyectoEstadoColumn(conexion);
            const tipoPkColumn = tipoColumn === "id_tipo_proyecto" ? "id_tipo_proyecto" : "id";
            const estadoPkColumn = estadoColumn === "id_estado_proyecto" ? "id_estado_proyecto" : "id";
            const where = [`p.${idColumn} = ?`];
            const param = [id];

            if (hasActivo) {
                where.push("p.activo = 1");
            } else if (hasObservaciones) {
                where.push("(p.observaciones IS NULL OR p.observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `SELECT p.*, p.${idColumn} AS id, p.${tipoColumn} AS tipo_proyecto_id, p.${estadoColumn} AS estado_proyecto_id,
                                  tp.nombre as tipo_nombre, ep.nombre as estado_nombre, ep.color_hex as estado_color
                           FROM proyectos p
                           LEFT JOIN tipos_proyectos tp ON p.${tipoColumn} = tp.${tipoPkColumn} AND tp.activo = 1
                           LEFT JOIN estados_proyectos ep ON p.${estadoColumn} = ep.${estadoPkColumn} AND ep.activo = 1
                           WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado[0] : null;
        } catch (error) {
            console.error('[Proyectos.selectProyectoById]', error);
            throw new Error('Error al obtener proyecto de la base de datos');
        }
    }

    // CREAR NUEVO PROYECTO
    async insertProyecto(codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_creacion, fecha_entrega, observaciones, ciclo_facturacion, fecha_inicio_servicio, fecha_proximo_pago, url_cobro_mercadopago, afecto_iva = 1, direccion_cliente = null, comuna_cliente = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const hasCiclo = await hasProyectosColumn(conexion, "ciclo_facturacion");
            const hasUrlCobro = await hasProyectosColumn(conexion, "url_cobro_mercadopago");
            const tipoColumn = await getProyectoTipoColumn(conexion);
            const estadoColumn = await getProyectoEstadoColumn(conexion);

            const cols = [
                "codigo_interno", "nombre", tipoColumn, estadoColumn,
                "nombre_cliente", "rut_cliente", "email_cliente", "telefono_cliente",
                "profesion_cliente", "monto_acordado", "fecha_creacion", "fecha_entrega", "observaciones"
            ];
            const vals = [
                codigo_interno, nombre, tipo_proyecto_id, estado_proyecto_id,
                nombre_cliente, rut_cliente, email_cliente, telefono_cliente,
                profesion_cliente, monto_acordado, fecha_creacion, fecha_entrega || null, observaciones
            ];

            if (hasCiclo) {
                cols.push("ciclo_facturacion", "fecha_inicio_servicio", "fecha_proximo_pago");
                vals.push(ciclo_facturacion || "Unico", fecha_inicio_servicio || null, fecha_proximo_pago || null);
            }

            if (hasUrlCobro) {
                cols.push("url_cobro_mercadopago");
                vals.push(url_cobro_mercadopago || null);
            }

            const hasAfectoIva = await hasProyectosColumn(conexion, "afecto_iva");
            if (hasAfectoIva) {
                cols.push("afecto_iva");
                vals.push(afecto_iva ? 1 : 0);
            }

            const hasDireccionCliente = await hasProyectosColumn(conexion, "direccion_cliente");
            if (hasDireccionCliente) {
                cols.push("direccion_cliente");
                vals.push(direccion_cliente || null);
            }

            const hasComunaCliente = await hasProyectosColumn(conexion, "comuna_cliente");
            if (hasComunaCliente) {
                cols.push("comuna_cliente");
                vals.push(comuna_cliente || null);
            }

            if (hasActivo) {
                cols.push("activo");
                vals.push(1);
            }

            const placeholders = vals.map(() => "?").join(", ");
            const query = `INSERT INTO proyectos (${cols.join(", ")}) VALUES (${placeholders})`;
            return await conexion.ejecutarQuery(query, vals);
        } catch (error) {
            console.error('[Proyectos.insertProyecto]', error);
            throw new Error('Error al crear proyecto en la base de datos');
        }
    }

    // ACTUALIZAR PROYECTO
    async updateProyecto(id, nombre, tipo_proyecto_id, estado_proyecto_id, nombre_cliente, rut_cliente, email_cliente, telefono_cliente, profesion_cliente, monto_acordado, fecha_entrega, observaciones, ciclo_facturacion, fecha_inicio_servicio, fecha_proximo_pago, url_cobro_mercadopago, afecto_iva = 1, direccion_cliente = null, comuna_cliente = null) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const hasObservaciones = await hasProyectosColumn(conexion, "observaciones");
            const hasCiclo = await hasProyectosColumn(conexion, "ciclo_facturacion");
            const hasUrlCobro = await hasProyectosColumn(conexion, "url_cobro_mercadopago");
            const hasAfectoIva = await hasProyectosColumn(conexion, "afecto_iva");
            const hasDireccionCliente = await hasProyectosColumn(conexion, "direccion_cliente");
            const hasComunaCliente = await hasProyectosColumn(conexion, "comuna_cliente");
            const idColumn = await getProyectoIdColumn(conexion);
            const tipoColumn = await getProyectoTipoColumn(conexion);
            const estadoColumn = await getProyectoEstadoColumn(conexion);

            const setParts = [
                `nombre = ?`, `${tipoColumn} = ?`, `${estadoColumn} = ?`,
                `nombre_cliente = ?`, `rut_cliente = ?`, `email_cliente = ?`,
                `telefono_cliente = ?`, `profesion_cliente = ?`, `monto_acordado = ?`,
                `fecha_entrega = ?`, `observaciones = ?`
            ];
            const param = [
                nombre,
                tipo_proyecto_id ?? null,
                estado_proyecto_id ?? null,
                nombre_cliente,
                rut_cliente ?? null,
                email_cliente ?? null,
                telefono_cliente ?? null,
                profesion_cliente ?? null,
                monto_acordado ?? null,
                fecha_entrega ?? null,
                observaciones ?? null
            ];

            if (hasCiclo) {
                setParts.push("ciclo_facturacion = ?", "fecha_inicio_servicio = ?", "fecha_proximo_pago = ?");
                param.push(ciclo_facturacion ?? "Unico", fecha_inicio_servicio ?? null, fecha_proximo_pago ?? null);
            }

            if (hasUrlCobro) {
                setParts.push("url_cobro_mercadopago = ?");
                param.push(url_cobro_mercadopago ?? null);
            }

            if (hasAfectoIva) {
                setParts.push("afecto_iva = ?");
                param.push(afecto_iva ? 1 : 0);
            }

            if (hasDireccionCliente) {
                setParts.push("direccion_cliente = ?");
                param.push(direccion_cliente ?? null);
            }

            if (hasComunaCliente) {
                setParts.push("comuna_cliente = ?");
                param.push(comuna_cliente ?? null);
            }

            param.push(id);
            const where = [`${idColumn} = ?`];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `UPDATE proyectos SET ${setParts.join(", ")} WHERE ${where.join(" AND ")}`;
            return await conexion.ejecutarQuery(query, param);
        } catch (error) {
            console.error('[Proyectos.updateProyecto] SQL error:', error);
            throw new Error('Error al actualizar proyecto en la base de datos');
        }
    }

    // CAMBIAR ESTADO DEL PROYECTO
    async updateEstadoProyecto(id, estado_proyecto_id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const hasObservaciones = await hasProyectosColumn(conexion, "observaciones");
            const idColumn = await getProyectoIdColumn(conexion);
            const estadoColumn = await getProyectoEstadoColumn(conexion);
            const where = [`${idColumn} = ?`];
            const param = [estado_proyecto_id, id];

            if (hasActivo) {
                where.push("activo = 1");
            } else if (hasObservaciones) {
                where.push("(observaciones IS NULL OR observaciones NOT LIKE ?)");
                param.push(`${SOFT_DELETE_PREFIX}%`);
            }

            const query = `UPDATE proyectos SET ${estadoColumn} = ? WHERE ${where.join(" AND ")}`;

            const resultado = await conexion.ejecutarQuery(query, param);
            return resultado;
        } catch (error) {
            console.error('[Proyectos.updateEstadoProyecto]', error);
            throw new Error('Error al cambiar estado del proyecto');
        }
    }

    // ELIMINAR PROYECTO
    async deleteProyecto(id) {
        const conexion = DataBase.getInstance();
        try {
            const hasActivo = await hasProyectosColumn(conexion, "activo");
            const idColumn = await getProyectoIdColumn(conexion);
            if (hasActivo) {
                const hasEliminadoEn = await hasProyectosColumn(conexion, "eliminado_en");
                const query = hasEliminadoEn
                    ? `UPDATE proyectos SET activo = 0, eliminado_en = NOW() WHERE ${idColumn} = ? AND activo = 1`
                    : `UPDATE proyectos SET activo = 0 WHERE ${idColumn} = ? AND activo = 1`;
                return await conexion.ejecutarQuery(query, [id]);
            }

            const marker = `${SOFT_DELETE_PREFIX}${id}#${Date.now()}#`;
            const query = `UPDATE proyectos
                           SET observaciones = CONCAT(?, COALESCE(observaciones, ''))
                           WHERE ${idColumn} = ? AND (observaciones IS NULL OR observaciones NOT LIKE ?)`;
            return await conexion.ejecutarQuery(query, [marker, id, `${SOFT_DELETE_PREFIX}%`]);
        } catch (error) {
            console.error('[Proyectos.deleteProyecto]', error);
            throw new Error('Error al eliminar proyecto de la base de datos');
        }
    }

    // OBTENER PAGOS DE UN PROYECTO
    async selectProyectoPagos(proyecto_id, pagination = null) {
        const conexion = DataBase.getInstance();
        try {
            const pagoIdColumn = await getProyectoPagoIdColumn(conexion);
            const proyectoFkColumn = await getProyectoPagoFkColumn(conexion);
            let query = `SELECT *, ${pagoIdColumn} AS id, ${proyectoFkColumn} AS proyecto_id
                           FROM proyecto_pagos
                           WHERE ${proyectoFkColumn} = ?
                           ORDER BY fecha_pago DESC`;
            const param = [proyecto_id];
            if (pagination) {
                query += " LIMIT ? OFFSET ?";
                param.push(Number(pagination.limit), Number(pagination.offset));
            }
            const resultado = await conexion.ejecutarQuery(query, param);
            return Array.isArray(resultado) && resultado.length > 0 ? resultado : [];
        } catch (error) {
            console.error('[Proyectos.selectProyectoPagos]', error);
            throw new Error('Error al obtener pagos del proyecto');
        }
    }

    // REGISTRAR PAGO DE PROYECTO (y actualizar monto_pagado + avanzar fecha_proximo_pago)
    async insertProyectoPago(proyecto_id, concepto, monto, fecha_pago, numero_comprobante, notas) {
        const conexion = DataBase.getInstance();
        try {
            const proyectoIdColumn = await getProyectoIdColumn(conexion);
            const proyectoFkColumn = await getProyectoPagoFkColumn(conexion);
            const queryInsert = `INSERT INTO proyecto_pagos (${proyectoFkColumn}, concepto, monto, fecha_pago, numero_comprobante, notas)
                                 VALUES (?, ?, ?, ?, ?, ?)`;
            const paramInsert = [proyecto_id, concepto, monto, fecha_pago, numero_comprobante, notas];
            const resultado = await conexion.ejecutarQuery(queryInsert, paramInsert);

            // Actualizar monto_pagado en el proyecto
            const queryUpdate = `UPDATE proyectos SET monto_pagado = (
                SELECT COALESCE(SUM(monto), 0) FROM proyecto_pagos WHERE ${proyectoFkColumn} = ?
            ) WHERE ${proyectoIdColumn} = ?`;
            await conexion.ejecutarQuery(queryUpdate, [proyecto_id, proyecto_id]);

            // Si existe ciclo de facturación, avanzar fecha_proximo_pago SOLO cuando lo
            // pagado dentro de la ventana del ciclo actual ya cubre el monto acordado.
            // Antes avanzaba con cualquier pago (aunque fuera un abono parcial o una
            // segunda cuota del mismo ciclo), lo que podía saltarse un cobro completo.
            const hasCiclo = await hasProyectosColumn(conexion, "ciclo_facturacion");
            if (hasCiclo) {
                const [proy] = await conexion.ejecutarQuery(
                    `SELECT ciclo_facturacion, fecha_proximo_pago, monto_acordado FROM proyectos WHERE ${proyectoIdColumn} = ?`,
                    [proyecto_id]
                );
                if (proy && proy.ciclo_facturacion && proy.ciclo_facturacion !== "Unico" && proy.fecha_proximo_pago) {
                    const mesesPorCiclo = { Mensual: 1, Trimestral: 3, Anual: 12 };
                    const paso = mesesPorCiclo[proy.ciclo_facturacion] || 0;
                    if (paso > 0) {
                        const dueDate = new Date(proy.fecha_proximo_pago);
                        const cycleStart = new Date(dueDate);
                        cycleStart.setUTCMonth(cycleStart.getUTCMonth() - paso);
                        const cycleStartStr = cycleStart.toISOString().slice(0, 10);

                        const [{ total: pagadoEnCiclo } = { total: 0 }] = await conexion.ejecutarQuery(
                            `SELECT COALESCE(SUM(monto), 0) AS total FROM proyecto_pagos
                             WHERE ${proyectoFkColumn} = ? AND fecha_pago >= ? AND fecha_pago <= ?`,
                            [proyecto_id, cycleStartStr, fecha_pago]
                        );

                        const montoAcordado = Number(proy.monto_acordado || 0);
                        if (montoAcordado <= 0 || Number(pagadoEnCiclo) >= montoAcordado) {
                            dueDate.setUTCMonth(dueDate.getUTCMonth() + paso);
                            const nextDate = dueDate.toISOString().slice(0, 10);
                            await conexion.ejecutarQuery(
                                `UPDATE proyectos SET fecha_proximo_pago = ? WHERE ${proyectoIdColumn} = ?`,
                                [nextDate, proyecto_id]
                            );
                        }
                    }
                }
            }

            return resultado;
        } catch (error) {
            console.error('[Proyectos.insertProyectoPago]', error);
            throw new Error('Error al registrar pago del proyecto');
        }
    }

    // ELIMINAR PAGO DE PROYECTO (recalcula monto_pagado)
    async deleteProyectoPago(pagoId) {
        const conexion = DataBase.getInstance();
        const proyectoIdColumn = await getProyectoIdColumn(conexion);
        const proyectoFkColumn = await getProyectoPagoFkColumn(conexion);

        const [pago] = await conexion.ejecutarQuery(
            `SELECT ${proyectoFkColumn} AS proyecto_id FROM proyecto_pagos WHERE id_proyecto_pago = ?`,
            [pagoId]
        );
        if (!pago) throw new Error('Pago no encontrado');

        await conexion.ejecutarQuery(`DELETE FROM proyecto_pagos WHERE id_proyecto_pago = ?`, [pagoId]);

        await conexion.ejecutarQuery(
            `UPDATE proyectos SET monto_pagado = (
                SELECT COALESCE(SUM(monto), 0) FROM proyecto_pagos WHERE ${proyectoFkColumn} = ?
            ) WHERE ${proyectoIdColumn} = ?`,
            [pago.proyecto_id, pago.proyecto_id]
        );
        return { ok: true };
    }

    // EDITAR PAGO DE PROYECTO (recalcula monto_pagado)
    async updateProyectoPago(pagoId, concepto, monto, fecha_pago, numero_comprobante, notas) {
        const conexion = DataBase.getInstance();
        const proyectoIdColumn = await getProyectoIdColumn(conexion);
        const proyectoFkColumn = await getProyectoPagoFkColumn(conexion);

        const [pago] = await conexion.ejecutarQuery(
            `SELECT ${proyectoFkColumn} AS proyecto_id FROM proyecto_pagos WHERE id_proyecto_pago = ?`,
            [pagoId]
        );
        if (!pago) throw new Error('Pago no encontrado');

        await conexion.ejecutarQuery(
            `UPDATE proyecto_pagos SET concepto = ?, monto = ?, fecha_pago = ?, numero_comprobante = ?, notas = ?
             WHERE id_proyecto_pago = ?`,
            [concepto, monto, fecha_pago, numero_comprobante ?? null, notas ?? null, pagoId]
        );

        await conexion.ejecutarQuery(
            `UPDATE proyectos SET monto_pagado = (
                SELECT COALESCE(SUM(monto), 0) FROM proyecto_pagos WHERE ${proyectoFkColumn} = ?
            ) WHERE ${proyectoIdColumn} = ?`,
            [pago.proyecto_id, pago.proyecto_id]
        );
        return { ok: true };
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
            console.error('[Proyectos.getNextCodigoInterno]', error);
            throw new Error('Error al generar código interno');
        }
    }
}
