import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

// Clientes agrupados desde proyectos (Phase 1 — sin tabla clientes)
export async function getClientes() {
    return db().ejecutarQuery(`
        SELECT
            nombre_cliente,
            MAX(email_cliente)      AS email_cliente,
            MAX(telefono_cliente)   AS telefono_cliente,
            MAX(rut_cliente)        AS rut_cliente,
            MAX(profesion_cliente)  AS profesion_cliente,
            COUNT(*)                AS total_proyectos,
            SUM(monto_acordado)     AS monto_total,
            SUM(COALESCE(monto_pagado,0))  AS monto_pagado_total,
            MAX(creado_en)          AS ultimo_proyecto,
            GROUP_CONCAT(id_proyecto ORDER BY creado_en DESC) AS proyectos_ids
        FROM proyectos
        WHERE activo = 1
          AND (observaciones IS NULL OR observaciones NOT LIKE '[ELIMINADO]#%')
        GROUP BY nombre_cliente
        ORDER BY nombre_cliente ASC
    `, []);
}

export async function getClienteProyectos(nombre_cliente) {
    return db().ejecutarQuery(`
        SELECT
            p.id_proyecto, p.codigo_interno, p.nombre, p.monto_acordado,
            p.monto_pagado, p.ciclo_facturacion, p.fecha_proximo_pago,
            p.fecha_creacion, p.activo,
            ep.nombre  AS estado_nombre,
            ep.color_hex AS estado_color,
            srv.ruta_backend AS servidor_backserver,
            srv.version      AS servidor_version,
            srv.estado       AS servidor_estado,
            be.id_entrada    AS boveda_id
        FROM proyectos p
        LEFT JOIN estados_proyectos ep ON p.id_estado_proyecto = ep.id_estado_proyecto
        LEFT JOIN synapse_servidores srv
            ON srv.id_servidor = (
                SELECT id_servidor FROM synapse_servidores
                WHERE id_proyecto = p.id_proyecto AND activo = 1
                ORDER BY id_servidor DESC LIMIT 1
            )
        LEFT JOIN boveda_entradas be ON be.id_proyecto = p.id_proyecto
        WHERE p.nombre_cliente = ?
          AND (p.observaciones IS NULL OR p.observaciones NOT LIKE '[ELIMINADO]#%')
        ORDER BY p.creado_en DESC
    `, [nombre_cliente]);
}
