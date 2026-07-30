import DataBase from '../config/Database.js';
import { fixedCostOccursInPeriod } from '../services/financeService.js';

const db = () => DataBase.getInstance();

const ESTADO_CANCELADO = 6;
const ESTADO_DESACTIVADA = 9;
const CATEGORIAS_MARKETING = [4, 7]; // Marketing, Publicidad — mismo catálogo que costos_variables

const NOT_DELETED = `(observaciones IS NULL OR observaciones NOT LIKE '[ELIMINADO]#%')`;

// Define qué cuenta como "cliente recurrente activo" en TODA la sección de Métricas
// de Negocio — mismo criterio en MRR, Churn y "clientes nuevos" (CAC/ASP/Tendencia).
// Un proyecto Único (trabajo puntual) no es un cliente SaaS adquirido, y activo=0 /
// estado Cancelado-Desactivada ya no cuenta aunque su fecha_creacion caiga en el período.
const CLIENTE_RECURRENTE_FILTER = `
    activo = 1
    AND ciclo_facturacion != 'Unico'
    AND id_estado_proyecto NOT IN (${ESTADO_CANCELADO}, ${ESTADO_DESACTIVADA})
    AND ${NOT_DELETED}
`;

const MRR_CASE = `
    CASE ciclo_facturacion
        WHEN 'Mensual'    THEN monto_acordado
        WHEN 'Trimestral' THEN monto_acordado / 3
        WHEN 'Anual'      THEN monto_acordado / 12
        ELSE 0
    END
`;

// MRR contractual + ARPA — cuentas agrupadas por nombre_cliente para no duplicar
// clientes con más de un proyecto recurrente.
export async function getMRRyARPA() {
    const rows = await db().ejecutarQuery(`
        SELECT nombre_cliente, SUM(${MRR_CASE}) AS mrr_cliente
        FROM proyectos
        WHERE ${CLIENTE_RECURRENTE_FILTER}
        GROUP BY nombre_cliente
    `, []);

    const cuentasActivas = rows.length;
    const mrr = rows.reduce((sum, r) => sum + Number(r.mrr_cliente || 0), 0);
    const arpa = cuentasActivas > 0 ? mrr / cuentasActivas : 0;

    return { mrr, cuentasActivas, arpa };
}

// Churn Rate — snapshot actual a nivel de proyecto (no hay historial de fechas
// de cancelación ni tabla de clientes, así que no es calculable por período).
export async function getChurnSnapshot() {
    const [row] = await db().ejecutarQuery(`
        SELECT
            SUM(CASE WHEN id_estado_proyecto IN (${ESTADO_CANCELADO}, ${ESTADO_DESACTIVADA}) THEN 1 ELSE 0 END) AS cancelados,
            COUNT(*) AS total
        FROM proyectos
        WHERE activo = 1
          AND ${NOT_DELETED}
    `, []);

    const cancelados = Number(row?.cancelados || 0);
    const total = Number(row?.total || 0);
    const churnRate = total > 0 ? cancelados / total : 0;

    return { cancelados, total, churnRate };
}

// Churn Rate por período — usa fecha_cancelacion, que solo se registra al pasar a
// Cancelado (no a Desactivada; ver migración 2026-07-30_proyectos_fecha_cancelacion.sql
// y control-back/model/Proyectos.js updateEstadoProyecto/updateProyecto).
// Si la columna todavía no existe en el servidor (migración no aplicada), se
// degrada a null en vez de romper el resto de las métricas — mismo patrón que
// getGastoMarketingFijo.
//
// cancelados = proyectos actualmente Cancelado cuya fecha_cancelacion cae dentro
// del período.
// base = proyectos que estaban "activos" al iniciar el período: cualquiera que
// hoy no esté Cancelado/Desactivada, MÁS los que sí están Cancelado pero cuya
// fecha_cancelacion es >= startDate (es decir, se cancelaron durante o después
// de este período, por lo que estaban vivos al comenzar). Cancelados sin fecha
// registrada (anteriores a la migración) o cancelados antes del período quedan
// fuera de la base — no se puede saber con certeza si estaban activos.
export async function getChurnPeriodo(startDate, endDate) {
    try {
        const [row] = await db().ejecutarQuery(`
            SELECT
                SUM(CASE
                    WHEN id_estado_proyecto = ${ESTADO_CANCELADO}
                     AND fecha_cancelacion BETWEEN ? AND ?
                    THEN 1 ELSE 0
                END) AS cancelados,
                SUM(CASE
                    WHEN id_estado_proyecto = ${ESTADO_DESACTIVADA} THEN 0
                    WHEN id_estado_proyecto != ${ESTADO_CANCELADO} THEN 1
                    WHEN fecha_cancelacion IS NOT NULL AND fecha_cancelacion >= ? THEN 1
                    ELSE 0
                END) AS base
            FROM proyectos
            WHERE ciclo_facturacion != 'Unico'
              AND activo = 1
              AND ${NOT_DELETED}
        `, [startDate, endDate, startDate]);

        const cancelados = Number(row?.cancelados || 0);
        const base = Number(row?.base || 0);
        const churnRate = base > 0 ? cancelados / base : null;

        return { cancelados, base, churnRate };
    } catch (e) {
        console.error('[MetricasNegocio.getChurnPeriodo]', e.message);
        return { cancelados: 0, base: 0, churnRate: null };
    }
}

// Gasto en costos FIJOS categorizados como Marketing/Publicidad (ej. Meta Ads, Google
// Ads) que vencen dentro del período — mismo criterio de caja que usa financeService
// para "C. Fijos Efectivos". Si la columna de categoría no existe aún (migración no
// aplicada), se degrada a 0 en vez de romper el resto de las métricas.
async function getGastoMarketingFijo(startDate, endDate) {
    try {
        const costosFijos = await db().ejecutarQuery(`
            SELECT cf.monto, cf.frecuencia, cf.fecha_pago, cf.fecha_inicio, cf.fecha_fin
            FROM costos_fijos cf
            INNER JOIN servicios s ON s.id_servicio = cf.id_servicio
            WHERE cf.activo = 1
              AND s.tipo_costo_variable_id IN (${CATEGORIAS_MARKETING.join(',')})
        `, []);

        const periodYear = Number(startDate.slice(0, 4));
        const periodMonthIndex = Number(startDate.slice(5, 7)) - 1;

        return costosFijos
            .filter((cost) => fixedCostOccursInPeriod(cost, periodYear, periodMonthIndex))
            .reduce((sum, cost) => sum + Number(cost.monto || 0), 0);
    } catch (e) {
        console.error('[MetricasNegocio.getGastoMarketingFijo]', e.message);
        return 0;
    }
}

// CAC — aproximación macro: gasto Marketing(4) + Publicidad(7) del período, ya sea
// cargado como costo variable puntual o como costo fijo recurrente (ej. Meta Ads),
// dividido por clientes nuevos del período (primer proyecto histórico del cliente).
export async function getCAC(startDate, endDate) {
    const [gastoRow] = await db().ejecutarQuery(`
        SELECT COALESCE(SUM(monto), 0) AS gasto
        FROM costos_variables
        WHERE fecha BETWEEN ? AND ?
          AND id_tipo_costo_variable IN (4, 7)
          AND activo = 1
    `, [startDate, endDate]);

    const [clientesRow] = await db().ejecutarQuery(`
        SELECT COUNT(*) AS clientes_nuevos
        FROM (
            SELECT nombre_cliente, MIN(fecha_creacion) AS primera_fecha
            FROM proyectos
            WHERE ${CLIENTE_RECURRENTE_FILTER}
            GROUP BY nombre_cliente
            HAVING primera_fecha BETWEEN ? AND ?
        ) nuevos
    `, [startDate, endDate]);

    const gastoMarketingFijo = await getGastoMarketingFijo(startDate, endDate);
    const gastoMarketing = Number(gastoRow?.gasto || 0) + gastoMarketingFijo;
    const clientesNuevos = Number(clientesRow?.clientes_nuevos || 0);
    const cac = clientesNuevos > 0 ? gastoMarketing / clientesNuevos : null;

    return { gastoMarketing, clientesNuevos, cac };
}

// ASP — MRR normalizado promedio del proyecto de alta de cada cliente recurrente
// nuevo del período (mismo criterio que CLIENTE_RECURRENTE_FILTER).
export async function getASP(startDate, endDate) {
    const rows = await db().ejecutarQuery(`
        SELECT p.nombre_cliente, ${MRR_CASE} AS mrr_alta
        FROM proyectos p
        INNER JOIN (
            SELECT nombre_cliente, MIN(fecha_creacion) AS primera_fecha
            FROM proyectos
            WHERE ${CLIENTE_RECURRENTE_FILTER}
            GROUP BY nombre_cliente
            HAVING primera_fecha BETWEEN ? AND ?
        ) nuevos
            ON nuevos.nombre_cliente = p.nombre_cliente
           AND nuevos.primera_fecha = p.fecha_creacion
        WHERE ${CLIENTE_RECURRENTE_FILTER}
    `, [startDate, endDate]);

    const clientesConsiderados = rows.length;
    const asp = clientesConsiderados > 0
        ? rows.reduce((sum, r) => sum + Number(r.mrr_alta || 0), 0) / clientesConsiderados
        : null;

    return { asp, clientesConsiderados };
}

// Tendencia últimos N meses — ingresos cobrados (caja real) y clientes nuevos.
// Datos reales, no se fabrica un histórico de MRR que no existe en el esquema.
export async function getTendenciaMensual(meses = 12) {
    const ingresos = await db().ejecutarQuery(`
        SELECT
            DATE_FORMAT(pp.fecha_pago, '%Y-%m') AS periodo,
            SUM(pp.monto) AS total
        FROM proyecto_pagos pp
        INNER JOIN proyectos p ON p.id_proyecto = pp.id_proyecto
        WHERE pp.fecha_pago >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
          AND p.activo = 1
        GROUP BY periodo
        ORDER BY periodo ASC
    `, [meses]);

    const clientesNuevos = await db().ejecutarQuery(`
        SELECT periodo, COUNT(*) AS total FROM (
            SELECT nombre_cliente, DATE_FORMAT(MIN(fecha_creacion), '%Y-%m') AS periodo
            FROM proyectos
            WHERE ${CLIENTE_RECURRENTE_FILTER}
            GROUP BY nombre_cliente
        ) altas
        WHERE periodo >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m')
        GROUP BY periodo
        ORDER BY periodo ASC
    `, [meses]);

    return { ingresos, clientesNuevos };
}
