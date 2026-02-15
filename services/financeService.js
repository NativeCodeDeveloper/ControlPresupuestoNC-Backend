import DataBase from "../config/Database.js";

const SOFT_DELETE_SOCIO_PREFIX = "[ELIMINADO]#";
const SOFT_DELETE_PREFIX = "[ELIMINADO]#";
const tableColumnsCache = new Map();

function normalizeMonth(rawMonth) {
    if (rawMonth === undefined || rawMonth === null || rawMonth === "") return null;
    const value = Number(rawMonth);
    if (Number.isNaN(value)) return null;
    if (value >= 0 && value <= 11) return value + 1;
    if (value >= 1 && value <= 12) return value;
    return null;
}

function normalizeYear(rawYear) {
    if (rawYear === undefined || rawYear === null || rawYear === "") return null;
    const value = Number(rawYear);
    if (Number.isNaN(value) || value < 2000 || value > 3000) return null;
    return value;
}

function normalizeDate(dateLike) {
    if (!dateLike) return null;

    if (dateLike instanceof Date) {
        if (Number.isNaN(dateLike.getTime())) return null;
        return new Date(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate());
    }

    if (typeof dateLike === "string") {
        const value = dateLike.trim();
        if (!value) return null;

        let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            return new Date(year, month - 1, day);
        }

        match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
        if (match) {
            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            return new Date(year, month - 1, day);
        }
    }

    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toSqlDate(dateLike) {
    const date = normalizeDate(dateLike);
    if (!date) return null;
    return date.toISOString().slice(0, 10);
}

function diffDays(fromDate, toDate) {
    const from = normalizeDate(fromDate);
    const to = normalizeDate(toDate);
    if (!from || !to) return null;
    const ms = to.getTime() - from.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function addDays(dateLike, days) {
    const date = normalizeDate(dateLike);
    if (!date) return null;
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(year, monthIndex, monthsToAdd) {
    const d = new Date(year, monthIndex + monthsToAdd, 1);
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function buildDateInMonth(year, monthIndex, dayOfMonth) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(Math.max(1, Number(dayOfMonth) || 1), lastDay);
    return new Date(year, monthIndex, day);
}

function getFrequencyStepMonths(frecuencia) {
    const value = String(frecuencia || "Mensual").toLowerCase();
    if (value.includes("trimes")) return 3;
    if (value.includes("anual")) return 12;
    return 1;
}

function fixedCostOccursInPeriod(cost, periodYear, periodMonthIndex) {
    const periodStart = new Date(periodYear, periodMonthIndex, 1);
    const periodEnd = new Date(periodYear, periodMonthIndex + 1, 0);
    const start = normalizeDate(cost?.fecha_inicio);
    const end = normalizeDate(cost?.fecha_fin);

    if (end && end < periodStart) return false;
    if (start && start > periodEnd) return false;

    const dueDate = computeNextFixedDueDate(cost, periodStart);
    if (!dueDate) return false;
    return dueDate >= periodStart && dueDate <= periodEnd;
}

function fixedCostIsActiveInPeriod(cost, periodYear, periodMonthIndex) {
    const periodStart = new Date(periodYear, periodMonthIndex, 1);
    const periodEnd = new Date(periodYear, periodMonthIndex + 1, 0);
    const start = normalizeDate(cost?.fecha_inicio);
    const end = normalizeDate(cost?.fecha_fin);

    if (start && start > periodEnd) return false;
    if (end && end < periodStart) return false;
    return true;
}

function computeNextFixedDueDate(cost, referenceDate = new Date()) {
    const ref = normalizeDate(referenceDate);
    const start = normalizeDate(cost?.fecha_inicio) || ref;
    const end = normalizeDate(cost?.fecha_fin);
    const paymentDay = Number(cost?.fecha_pago || start.getDate());
    const stepMonths = Math.max(1, Number(getFrequencyStepMonths(cost?.frecuencia) || 1));

    // Regla de negocio:
    // - Mensual: puede vencer dentro del mismo mes de inicio.
    // - Trimestral/Anual: el primer vencimiento ocurre en el siguiente ciclo.
    let due;
    if (stepMonths > 1) {
        const moved = addMonths(start.getFullYear(), start.getMonth(), stepMonths);
        due = buildDateInMonth(moved.year, moved.monthIndex, paymentDay);
    } else {
        due = buildDateInMonth(start.getFullYear(), start.getMonth(), paymentDay);
        if (due < start) {
            const moved = addMonths(start.getFullYear(), start.getMonth(), stepMonths);
            due = buildDateInMonth(moved.year, moved.monthIndex, paymentDay);
        }
    }

    let guard = 0;
    while (due < ref && guard < 600) {
        const moved = addMonths(due.getFullYear(), due.getMonth(), stepMonths);
        due = buildDateInMonth(moved.year, moved.monthIndex, paymentDay);
        guard += 1;
    }

    if (guard >= 600) {
        return null;
    }

    if (end && due > end) return null;
    return due;
}

async function safeQuery(conexion, query, params = [], fallback = []) {
    try {
        return await conexion.ejecutarQuery(query, params);
    } catch (_) {
        return fallback;
    }
}

async function getTableColumns(conexion, tableName) {
    if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName);

    const rows = await safeQuery(
        conexion,
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName],
        []
    );

    const cols = new Set(
        (Array.isArray(rows) ? rows : [])
            .map((r) => String(r.COLUMN_NAME || "").trim())
            .filter(Boolean)
    );

    tableColumnsCache.set(tableName, cols);
    return cols;
}

async function getConfigIdColumn(conexion) {
    const cols = await getTableColumns(conexion, "configuracion_financiera");
    return cols.has("id_configuracion_financiera") ? "id_configuracion_financiera" : "id";
}

async function getSocioIdColumn(conexion) {
    const cols = await getTableColumns(conexion, "socios");
    return cols.has("id_socio") ? "id_socio" : "id";
}

async function getRetiroSocioColumn(conexion) {
    const cols = await getTableColumns(conexion, "retiros_socios");
    return cols.has("id_socio") ? "id_socio" : "socio_id";
}

async function getCostoFijoIdColumn(conexion) {
    const cols = await getTableColumns(conexion, "costos_fijos");
    return cols.has("id_costo_fijo") ? "id_costo_fijo" : "id";
}

async function getCostoFijoServicioColumn(conexion) {
    const cols = await getTableColumns(conexion, "costos_fijos");
    return cols.has("id_servicio") ? "id_servicio" : "servicio_id";
}

async function getServicioIdColumn(conexion) {
    const cols = await getTableColumns(conexion, "servicios");
    return cols.has("id_servicio") ? "id_servicio" : "id";
}

async function getCostoVariableIdColumn(conexion) {
    const cols = await getTableColumns(conexion, "costos_variables");
    return cols.has("id_costo_variable") ? "id_costo_variable" : "id";
}

async function getCostosFijosNotDeletedFilter(conexion, alias = "") {
    const cols = await getTableColumns(conexion, "costos_fijos");
    const prefix = alias ? `${alias}.` : "";

    if (cols.has("activo")) {
        return { whereClause: `${prefix}activo = 1`, params: [] };
    }

    if (cols.has("notas")) {
        return {
            whereClause: `(${prefix}notas IS NULL OR ${prefix}notas NOT LIKE ?)`,
            params: [`${SOFT_DELETE_PREFIX}%`]
        };
    }

    return { whereClause: "", params: [] };
}

async function getCostosVariablesNotDeletedFilter(conexion, alias = "") {
    const cols = await getTableColumns(conexion, "costos_variables");
    const prefix = alias ? `${alias}.` : "";

    if (cols.has("activo")) {
        return { whereClause: `${prefix}activo = 1`, params: [] };
    }

    if (cols.has("observaciones")) {
        return {
            whereClause: `(${prefix}observaciones IS NULL OR ${prefix}observaciones NOT LIKE ?)`,
            params: [`${SOFT_DELETE_PREFIX}%`]
        };
    }

    return { whereClause: "", params: [] };
}

async function getInversionesNotDeletedFilter(conexion, alias = "") {
    const cols = await getTableColumns(conexion, "inversiones");
    const prefix = alias ? `${alias}.` : "";

    if (cols.has("activo")) {
        return { whereClause: `${prefix}activo = 1`, params: [] };
    }

    if (cols.has("observaciones")) {
        return {
            whereClause: `(${prefix}observaciones IS NULL OR ${prefix}observaciones NOT LIKE ?)`,
            params: [`${SOFT_DELETE_PREFIX}%`]
        };
    }

    return { whereClause: "", params: [] };
}

async function getRetirosNotDeletedFilter(conexion, alias = "") {
    const cols = await getTableColumns(conexion, "retiros_socios");
    const prefix = alias ? `${alias}.` : "";

    if (cols.has("activo")) {
        return { whereClause: `${prefix}activo = 1`, params: [] };
    }

    if (cols.has("observaciones")) {
        return {
            whereClause: `(${prefix}observaciones IS NULL OR ${prefix}observaciones NOT LIKE ?)`,
            params: [`${SOFT_DELETE_PREFIX}%`]
        };
    }

    return { whereClause: "", params: [] };
}

async function getActivePartners(conexion) {
    const sociosColumns = await getTableColumns(conexion, "socios");
    const hasActivoSocios = sociosColumns.has("activo");
    const socioIdColumn = await getSocioIdColumn(conexion);

    const query = hasActivoSocios
        ? `SELECT ${socioIdColumn} AS id, nombre, porcentaje_participacion
           FROM socios
           WHERE activo = 1
           ORDER BY nombre`
        : `SELECT ${socioIdColumn} AS id, nombre, porcentaje_participacion
           FROM socios
           WHERE nombre NOT LIKE ?
           ORDER BY nombre`;
    const params = hasActivoSocios ? [] : [`${SOFT_DELETE_SOCIO_PREFIX}%`];

    const rows = await safeQuery(conexion, query, params, []);
    return Array.isArray(rows) ? rows : [];
}

async function getPartnersWithdrawalsMap(conexion, startDate, endDate) {
    const retiroSocioColumn = await getRetiroSocioColumn(conexion);
    const retirosFilter = await getRetirosNotDeletedFilter(conexion);
    const where = ["fecha_retiro BETWEEN ? AND ?"];
    const params = [startDate, endDate];

    if (retirosFilter.whereClause) {
        where.push(retirosFilter.whereClause);
        params.push(...retirosFilter.params);
    }

    const rows = await safeQuery(
        conexion,
        `SELECT ${retiroSocioColumn} AS id_socio, COALESCE(SUM(monto), 0) AS retirado
         FROM retiros_socios
         WHERE ${where.join(" AND ")}
         GROUP BY ${retiroSocioColumn}`,
        params,
        []
    );

    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const socioId = Number(row?.id_socio);
        if (!Number.isFinite(socioId)) return;
        map.set(socioId, Number(row?.retirado || 0));
    });
    return map;
}

async function getFinancialConfigRow(conexion) {
    const configIdColumn = await getConfigIdColumn(conexion);

    const [preferred] = await safeQuery(
        conexion,
        `SELECT porcentaje_fondo_emergencia, porcentaje_reinversion
         FROM configuracion_financiera
         WHERE ${configIdColumn} = 1
         LIMIT 1`,
        [],
        []
    );
    if (preferred) {
        return preferred;
    }

    const [fallback] = await safeQuery(
        conexion,
        `SELECT porcentaje_fondo_emergencia, porcentaje_reinversion
         FROM configuracion_financiera
         ORDER BY ${configIdColumn} ASC
         LIMIT 1`,
        [],
        []
    );
    if (fallback) {
        return fallback;
    }

    return {
        porcentaje_fondo_emergencia: 10,
        porcentaje_reinversion: 3
    };
}

async function getVariableCostsTotalInRange(conexion, startDate, endDate) {
    const filter = await getCostosVariablesNotDeletedFilter(conexion);
    const where = ["fecha BETWEEN ? AND ?"];
    const params = [startDate, endDate];

    if (filter.whereClause) {
        where.push(filter.whereClause);
        params.push(...filter.params);
    }

    const [row] = await safeQuery(
        conexion,
        `SELECT COALESCE(SUM(monto), 0) AS total
         FROM costos_variables
         WHERE ${where.join(" AND ")}`,
        params,
        [{}]
    );

    return Number(row?.total || 0);
}

async function getFixedCostsData(conexion) {
    const columns = await getTableColumns(conexion, "costos_fijos");
    const idColumn = await getCostoFijoIdColumn(conexion);

    const hasFechaInicio = columns.has("fecha_inicio");
    const hasFechaFin = columns.has("fecha_fin");
    const hasFrecuencia = columns.has("frecuencia");
    const hasFechaPago = columns.has("fecha_pago");

    const selectFrecuencia = hasFrecuencia ? "frecuencia" : "'Mensual' AS frecuencia";
    const selectFechaPago = hasFechaPago ? "fecha_pago" : "1 AS fecha_pago";
    const selectFechaInicio = hasFechaInicio ? "fecha_inicio" : "NULL AS fecha_inicio";
    const selectFechaFin = hasFechaFin ? "fecha_fin" : "NULL AS fecha_fin";
    const filter = await getCostosFijosNotDeletedFilter(conexion);
    const whereClause = filter.whereClause ? `WHERE ${filter.whereClause}` : "";

    return safeQuery(
        conexion,
        `SELECT ${idColumn} AS id, monto, ${selectFrecuencia}, ${selectFechaPago}, ${selectFechaInicio}, ${selectFechaFin}
         FROM costos_fijos
         ${whereClause}`,
        filter.params,
        []
    );
}

async function getInvestmentSums(conexion, startDate, endDate) {
    const hasRange = Boolean(startDate && endDate);
    const rangeWhere = hasRange ? ["fecha_inversion BETWEEN ? AND ?"] : [];
    const params = hasRange ? [startDate, endDate] : [];
    const filter = await getInversionesNotDeletedFilter(conexion);

    if (filter.whereClause) {
        rangeWhere.push(filter.whereClause);
        params.push(...filter.params);
    }

    const whereClause = rangeWhere.length > 0 ? `WHERE ${rangeWhere.join(" AND ")}` : "";

    try {
        const [row] = await conexion.ejecutarQuery(
            `SELECT
                COALESCE(SUM(CASE WHEN fondo_origen = 'reinversion' THEN monto ELSE 0 END), 0) AS reinversion,
                COALESCE(SUM(CASE WHEN fondo_origen = 'emergencia' THEN monto ELSE 0 END), 0) AS emergencia,
                COALESCE(SUM(monto), 0) AS total
             FROM inversiones
             ${whereClause}`,
            params
        );

        return {
            reinversion: Number(row?.reinversion || 0),
            emergencia: Number(row?.emergencia || 0),
            total: Number(row?.total || 0)
        };
    } catch (_) {
        try {
            const [row] = await conexion.ejecutarQuery(
                `SELECT COALESCE(SUM(monto), 0) AS total FROM inversiones ${whereClause}`,
                params
            );
            const total = Number(row?.total || 0);
            return { reinversion: total, emergencia: 0, total };
        } catch (_) {
            return { reinversion: 0, emergencia: 0, total: 0 };
        }
    }
}

async function getRealtimeAssignedFunds(conexion) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [totals] = await safeQuery(
        conexion,
        `SELECT
            COALESCE(SUM(deduccion_reinversion), 0) AS reinversion_total,
            COALESCE(SUM(deduccion_fondo_emergencia), 0) AS emergencia_total
         FROM resumen_mensual`,
        [],
        [{}]
    );

    const [currentMonthSummary] = await safeQuery(
        conexion,
        `SELECT
            COALESCE(SUM(deduccion_reinversion), 0) AS reinversion_actual,
            COALESCE(SUM(deduccion_fondo_emergencia), 0) AS emergencia_actual
         FROM resumen_mensual
         WHERE \`año\` = ? AND mes = ?`,
        [currentYear, currentMonth],
        [{}]
    );

    const historicReinvestment = Math.max(
        0,
        Number(totals?.reinversion_total || 0) - Number(currentMonthSummary?.reinversion_actual || 0)
    );
    const historicEmergency = Math.max(
        0,
        Number(totals?.emergencia_total || 0) - Number(currentMonthSummary?.emergencia_actual || 0)
    );

    // Se calcula el mes actual en tiempo real para reflejar de inmediato nuevos ingresos/gastos.
    const currentEstimate = await estimateCurrentMonthAssignedFunds(conexion);

    return {
        reinversion: historicReinvestment + Number(currentEstimate?.reinversion || 0),
        emergencia: historicEmergency + Number(currentEstimate?.emergencia || 0)
    };
}

async function estimateCurrentMonthAssignedFunds(conexion) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const [ingresos] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM proyecto_pagos WHERE fecha_pago BETWEEN ? AND ?",
        [startDate, endDate],
        [{}]
    );

    const fixedCostsData = await getFixedCostsData(conexion);

    const variable = await getVariableCostsTotalInRange(conexion, startDate, endDate);

    const totalFixedCosts = (Array.isArray(fixedCostsData) ? fixedCostsData : [])
        .filter((cost) => fixedCostOccursInPeriod(cost, year, month - 1))
        .reduce((sum, cost) => {
            const amount = Number.parseFloat(cost?.monto);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

    const income = Number(ingresos?.total || 0);
    const base = Math.max(0, income - totalFixedCosts - variable);

    const config = await getFinancialConfigRow(conexion);

    const pctEmerg = Number(config?.porcentaje_fondo_emergencia || 0);
    const pctReinv = Number(config?.porcentaje_reinversion || 0);

    return {
        reinversion: (base * pctReinv) / 100,
        emergencia: (base * pctEmerg) / 100
    };
}

export function getPeriodFromQuery(query = {}) {
    const month = normalizeMonth(query.mes ?? query.month);
    const year = normalizeYear(query.año ?? query.anio ?? query.year);

    const now = new Date();
    const finalYear = year ?? now.getFullYear();
    const finalMonth = month ?? (now.getMonth() + 1);

    const startDate = `${finalYear}-${String(finalMonth).padStart(2, "0")}-01`;
    const endDate = new Date(finalYear, finalMonth, 0).toISOString().slice(0, 10);

    return {
        month: finalMonth,
        year: finalYear,
        startDate,
        endDate
    };
}

async function getFondosSaldos(conexion) {
    const assigned = await getRealtimeAssignedFunds(conexion);
    const used = await getInvestmentSums(conexion);

    return {
        reinversion: {
            asignado: Number(assigned.reinversion || 0),
            usado: Number(used.reinversion || 0),
            disponible: Math.max(0, Number(assigned.reinversion || 0) - Number(used.reinversion || 0))
        },
        emergencia: {
            asignado: Number(assigned.emergencia || 0),
            usado: Number(used.emergencia || 0),
            disponible: Math.max(0, Number(assigned.emergencia || 0) - Number(used.emergencia || 0))
        }
    };
}

function buildPeriod(year, month) {
    const safeYear = Number(year);
    const safeMonth = Number(month);
    return {
        year: safeYear,
        month: safeMonth,
        startDate: `${safeYear}-${String(safeMonth).padStart(2, "0")}-01`,
        endDate: new Date(safeYear, safeMonth, 0).toISOString().slice(0, 10)
    };
}

async function getPeriodFinancialCore(conexion, period, context = {}) {
    const config = context.config || await getFinancialConfigRow(conexion);
    const fixedCostsData = context.fixedCostsData || await getFixedCostsData(conexion);
    const retirosFilter = context.retirosFilter || await getRetirosNotDeletedFilter(conexion);

    const [ingresos] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM proyecto_pagos WHERE fecha_pago BETWEEN ? AND ?",
        [period.startDate, period.endDate],
        [{}]
    );

    const totalVariableCosts = await getVariableCostsTotalInRange(conexion, period.startDate, period.endDate);

    const retirosWhere = ["fecha_retiro BETWEEN ? AND ?"];
    const retirosParams = [period.startDate, period.endDate];
    if (retirosFilter.whereClause) {
        retirosWhere.push(retirosFilter.whereClause);
        retirosParams.push(...retirosFilter.params);
    }

    const [retirosMes] = await safeQuery(
        conexion,
        `SELECT COALESCE(SUM(monto), 0) AS total
         FROM retiros_socios
         WHERE ${retirosWhere.join(" AND ")}`,
        retirosParams,
        [{}]
    );

    const totalIncome = Number(ingresos?.total || 0);
    const totalFixedCosts = (Array.isArray(fixedCostsData) ? fixedCostsData : [])
        .filter((cost) => fixedCostOccursInPeriod(cost, period.year, period.month - 1))
        .reduce((sum, cost) => {
            const amount = Number.parseFloat(cost?.monto);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
    const totalFixedCostsCommitted = (Array.isArray(fixedCostsData) ? fixedCostsData : [])
        .filter((cost) => fixedCostIsActiveInPeriod(cost, period.year, period.month - 1))
        .reduce((sum, cost) => {
            const amount = Number.parseFloat(cost?.monto);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
    const totalExpenses = totalFixedCosts + totalVariableCosts;

    const operatingResult = totalIncome - totalExpenses;
    const baseForDeductions = Math.max(0, operatingResult);

    const emergencyPct = Number(config?.porcentaje_fondo_emergencia || 0);
    const reinvestPct = Number(config?.porcentaje_reinversion || 0);

    const emergencyFundDeduction = (baseForDeductions * emergencyPct) / 100;
    const reinvestmentDeduction = (baseForDeductions * reinvestPct) / 100;

    const netProfit = operatingResult - emergencyFundDeduction - reinvestmentDeduction;
    const withdrawals = Number(retirosMes?.total || 0);
    const partnersAvailable = Math.max(0, netProfit - withdrawals);

    return {
        totalIncome,
        totalFixedCosts,
        totalFixedCostsCommitted,
        totalVariableCosts,
        totalExpenses,
        operatingResult,
        emergencyPct,
        reinvestPct,
        emergencyFundDeduction,
        reinvestmentDeduction,
        netProfit,
        withdrawals,
        partnersAvailable
    };
}

async function getFirstRelevantPeriod(conexion, targetPeriod, context = {}) {
    const retirosFilter = context.retirosFilter || await getRetirosNotDeletedFilter(conexion);
    const variableFilter = context.variableFilter || await getCostosVariablesNotDeletedFilter(conexion);
    const fixedFilter = context.fixedFilter || await getCostosFijosNotDeletedFilter(conexion);

    const [pagos] = await safeQuery(
        conexion,
        "SELECT MIN(fecha_pago) AS min_date FROM proyecto_pagos WHERE fecha_pago <= ?",
        [targetPeriod.endDate],
        [{}]
    );

    const variableWhere = ["fecha <= ?"];
    const variableParams = [targetPeriod.endDate];
    if (variableFilter.whereClause) {
        variableWhere.push(variableFilter.whereClause);
        variableParams.push(...variableFilter.params);
    }
    const [variables] = await safeQuery(
        conexion,
        `SELECT MIN(fecha) AS min_date
         FROM costos_variables
         WHERE ${variableWhere.join(" AND ")}`,
        variableParams,
        [{}]
    );

    const fixedWhere = ["fecha_inicio <= ?"];
    const fixedParams = [targetPeriod.endDate];
    if (fixedFilter.whereClause) {
        fixedWhere.push(fixedFilter.whereClause);
        fixedParams.push(...fixedFilter.params);
    }
    const [fijos] = await safeQuery(
        conexion,
        `SELECT MIN(fecha_inicio) AS min_date
         FROM costos_fijos
         WHERE ${fixedWhere.join(" AND ")}`,
        fixedParams,
        [{}]
    );

    const retirosWhere = ["fecha_retiro <= ?"];
    const retirosParams = [targetPeriod.endDate];
    if (retirosFilter.whereClause) {
        retirosWhere.push(retirosFilter.whereClause);
        retirosParams.push(...retirosFilter.params);
    }
    const [retiros] = await safeQuery(
        conexion,
        `SELECT MIN(fecha_retiro) AS min_date
         FROM retiros_socios
         WHERE ${retirosWhere.join(" AND ")}`,
        retirosParams,
        [{}]
    );

    const dates = [pagos?.min_date, variables?.min_date, fijos?.min_date, retiros?.min_date]
        .map((value) => normalizeDate(value))
        .filter(Boolean);

    if (dates.length === 0) {
        return { year: targetPeriod.year, month: targetPeriod.month };
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    return {
        year: first.getFullYear(),
        month: first.getMonth() + 1
    };
}

function mapMonthlyRows(rows = []) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const year = Number(row?.year || row?.año || row?.anio);
        const month = Number(row?.month || row?.mes);
        const total = Number(row?.total || 0);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return;
        map.set(`${year}-${month}`, total);
    });
    return map;
}

async function getMonthlyAggregates(conexion, startDate, endDate, context = {}) {
    const variableFilter = context.variableFilter || await getCostosVariablesNotDeletedFilter(conexion);
    const retirosFilter = context.retirosFilter || await getRetirosNotDeletedFilter(conexion);

    const incomeRows = await safeQuery(
        conexion,
        `SELECT YEAR(fecha_pago) AS year, MONTH(fecha_pago) AS month, COALESCE(SUM(monto), 0) AS total
         FROM proyecto_pagos
         WHERE fecha_pago BETWEEN ? AND ?
         GROUP BY YEAR(fecha_pago), MONTH(fecha_pago)`,
        [startDate, endDate],
        []
    );

    const variableWhere = ["fecha BETWEEN ? AND ?"];
    const variableParams = [startDate, endDate];
    if (variableFilter.whereClause) {
        variableWhere.push(variableFilter.whereClause);
        variableParams.push(...variableFilter.params);
    }
    const variableRows = await safeQuery(
        conexion,
        `SELECT YEAR(fecha) AS year, MONTH(fecha) AS month, COALESCE(SUM(monto), 0) AS total
         FROM costos_variables
         WHERE ${variableWhere.join(" AND ")}
         GROUP BY YEAR(fecha), MONTH(fecha)`,
        variableParams,
        []
    );

    const retirosWhere = ["fecha_retiro BETWEEN ? AND ?"];
    const retirosParams = [startDate, endDate];
    if (retirosFilter.whereClause) {
        retirosWhere.push(retirosFilter.whereClause);
        retirosParams.push(...retirosFilter.params);
    }
    const withdrawalRows = await safeQuery(
        conexion,
        `SELECT YEAR(fecha_retiro) AS year, MONTH(fecha_retiro) AS month, COALESCE(SUM(monto), 0) AS total
         FROM retiros_socios
         WHERE ${retirosWhere.join(" AND ")}
         GROUP BY YEAR(fecha_retiro), MONTH(fecha_retiro)`,
        retirosParams,
        []
    );

    return {
        income: mapMonthlyRows(incomeRows),
        variable: mapMonthlyRows(variableRows),
        withdrawals: mapMonthlyRows(withdrawalRows)
    };
}

async function getPartnersAvailableAccumulated(conexion, targetPeriod, context = {}) {
    const firstPeriod = await getFirstRelevantPeriod(conexion, targetPeriod, context);
    const config = context.config || await getFinancialConfigRow(conexion);
    const fixedCostsData = context.fixedCostsData || await getFixedCostsData(conexion);
    const firstStartDate = `${firstPeriod.year}-${String(firstPeriod.month).padStart(2, "0")}-01`;
    const monthly = await getMonthlyAggregates(conexion, firstStartDate, targetPeriod.endDate, context);

    let year = firstPeriod.year;
    let month = firstPeriod.month;
    let accumulated = 0;
    let guard = 0;

    while (
        (year < targetPeriod.year || (year === targetPeriod.year && month <= targetPeriod.month))
        && guard < 600
    ) {
        const monthKey = `${year}-${month}`;
        const income = Number(monthly.income.get(monthKey) || 0);
        const variableCosts = Number(monthly.variable.get(monthKey) || 0);
        const withdrawals = Number(monthly.withdrawals.get(monthKey) || 0);
        const fixedCosts = (Array.isArray(fixedCostsData) ? fixedCostsData : [])
            .filter((cost) => fixedCostOccursInPeriod(cost, year, month - 1))
            .reduce((sum, cost) => {
                const amount = Number.parseFloat(cost?.monto);
                return sum + (Number.isFinite(amount) ? amount : 0);
            }, 0);

        const operatingResult = income - fixedCosts - variableCosts;
        const baseForDeductions = Math.max(0, operatingResult);
        const emergencyPct = Number(config?.porcentaje_fondo_emergencia || 0);
        const reinvestPct = Number(config?.porcentaje_reinversion || 0);
        const emergencyDeduction = (baseForDeductions * emergencyPct) / 100;
        const reinvestDeduction = (baseForDeductions * reinvestPct) / 100;
        const netProfit = operatingResult - emergencyDeduction - reinvestDeduction;

        const delta = Number(netProfit || 0) - withdrawals;
        accumulated = Math.max(0, accumulated + delta);

        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        guard += 1;
    }

    return Math.max(0, accumulated);
}

export async function getFinancialSummary(query = {}) {
    const conexion = DataBase.getInstance();
    const period = getPeriodFromQuery(query);
    const config = await getFinancialConfigRow(conexion);
    const fixedCostsData = await getFixedCostsData(conexion);
    const retirosFilter = await getRetirosNotDeletedFilter(conexion);
    const variableFilter = await getCostosVariablesNotDeletedFilter(conexion);
    const fixedFilter = await getCostosFijosNotDeletedFilter(conexion);
    const summaryContext = {
        config,
        fixedCostsData,
        retirosFilter,
        variableFilter,
        fixedFilter
    };
    const core = await getPeriodFinancialCore(conexion, period, summaryContext);

    const inversionesPeriodo = await getInvestmentSums(conexion, period.startDate, period.endDate);
    const accumulatedPartnersAvailable = await getPartnersAvailableAccumulated(conexion, period, summaryContext);

    const partners = await getActivePartners(conexion);
    const partnersWithdrawalsMap = await getPartnersWithdrawalsMap(conexion, period.startDate, period.endDate);
    const partnersAvailability = partners.map((partner) => {
        const partnerId = Number(partner?.id);
        const percentage = Number(partner?.porcentaje_participacion || 0);
        const assigned = Math.max(0, (core.netProfit * percentage) / 100);
        const withdrawn = Number(partnersWithdrawalsMap.get(partnerId) || 0);
        const available = Math.max(0, assigned - withdrawn);

        return {
            id: partnerId,
            name: partner?.nombre || `Socio ${partnerId}`,
            percentage,
            assigned,
            withdrawn,
            available
        };
    });

    // Fuente canónica de disponible para socios en el período:
    // neto del período menos retiros del período.
    // Esto evita divergencias entre vistas cuando los porcentajes no suman 100%
    // o cuando existen retiros históricos de socios inactivos.
    const totalPartnersAvailable = core.partnersAvailable;

    const fondos = await getFondosSaldos(conexion);

    return {
        period,
        config: {
            porcentaje_fondo_emergencia: core.emergencyPct,
            porcentaje_reinversion: core.reinvestPct
        },
        income: core.totalIncome,
        fixedCosts: core.totalFixedCosts,
        fixedCostsCommitted: core.totalFixedCostsCommitted,
        variableCosts: core.totalVariableCosts,
        expenses: core.totalExpenses,
        operatingResult: core.operatingResult,
        emergencyFundDeduction: core.emergencyFundDeduction,
        reinvestmentDeduction: core.reinvestmentDeduction,
        netProfit: core.netProfit,
        withdrawals: core.withdrawals,
        partnersAvailable: core.partnersAvailable,
        totalPartnersAvailable,
        partnersAvailableAccumulated: accumulatedPartnersAvailable,
        totalPartnersAvailableAccumulated: accumulatedPartnersAvailable,
        partnersAvailability,
        investments: inversionesPeriodo,
        fondos
    };
}

export async function getPartnerAvailableAmount(socioId, query = {}) {
    const conexion = DataBase.getInstance();
    const summary = await getFinancialSummary(query);

    const sociosColumns = await getTableColumns(conexion, "socios");
    const hasActivoSocios = sociosColumns.has("activo");
    const socioIdColumn = await getSocioIdColumn(conexion);
    const retiroSocioColumn = await getRetiroSocioColumn(conexion);
    const socioQuery = hasActivoSocios
        ? `SELECT ${socioIdColumn} AS id, nombre, porcentaje_participacion
           FROM socios
           WHERE ${socioIdColumn} = ? AND activo = 1`
        : `SELECT ${socioIdColumn} AS id, nombre, porcentaje_participacion
           FROM socios
           WHERE ${socioIdColumn} = ? AND nombre NOT LIKE ?`;
    const socioParams = hasActivoSocios
        ? [socioId]
        : [socioId, `${SOFT_DELETE_SOCIO_PREFIX}%`];

    const [socio] = await safeQuery(
        conexion,
        socioQuery,
        socioParams,
        []
    );

    if (!socio) {
        return null;
    }

    const assigned = Math.max(0, (summary.netProfit * Number(socio.porcentaje_participacion || 0)) / 100);
    const retirosFilter = await getRetirosNotDeletedFilter(conexion);
    const retirosWhere = [`${retiroSocioColumn} = ?`, "fecha_retiro BETWEEN ? AND ?"];
    const retirosParams = [socioId, summary.period.startDate, summary.period.endDate];
    if (retirosFilter.whereClause) {
        retirosWhere.push(retirosFilter.whereClause);
        retirosParams.push(...retirosFilter.params);
    }

    const [retiros] = await safeQuery(
        conexion,
        `SELECT COALESCE(SUM(monto), 0) AS total
         FROM retiros_socios
         WHERE ${retirosWhere.join(" AND ")}`,
        retirosParams,
        [{}]
    );

    const retirado = Number(retiros?.total || 0);
    const disponible = Math.max(0, assigned - retirado);

    return {
        socio: {
            id: Number(socio.id),
            nombre: socio.nombre,
            porcentaje_participacion: Number(socio.porcentaje_participacion || 0)
        },
        period: summary.period,
        asignado: assigned,
        retirado,
        disponible
    };
}

export async function getUpcomingDueItems(query = {}) {
    const conexion = DataBase.getInstance();
    const dias = Number(query.dias || query.days || 7);
    const windowDays = Number.isFinite(dias) ? Math.max(1, Math.min(90, dias)) : 7;

    const today = normalizeDate(new Date());
    const limitDate = addDays(today, windowDays);

    const costoFijoIdColumn = await getCostoFijoIdColumn(conexion);
    const costoFijoServicioColumn = await getCostoFijoServicioColumn(conexion);
    const servicioIdColumn = await getServicioIdColumn(conexion);
    const costoVariableIdColumn = await getCostoVariableIdColumn(conexion);

    const fixedFilter = await getCostosFijosNotDeletedFilter(conexion, "cf");
    const fixedWhere = ["(cf.fecha_fin IS NULL OR cf.fecha_fin >= CURDATE())"];
    const fixedParams = [];
    if (fixedFilter.whereClause) {
        fixedWhere.push(fixedFilter.whereClause);
        fixedParams.push(...fixedFilter.params);
    }

    let fixedCosts = await safeQuery(
        conexion,
        `SELECT cf.*, cf.${costoFijoIdColumn} AS id, s.nombre as servicio_nombre
         FROM costos_fijos cf
         LEFT JOIN servicios s ON cf.${costoFijoServicioColumn} = s.${servicioIdColumn}
         WHERE ${fixedWhere.join(" AND ")}`,
        fixedParams,
        null
    );

    if (!Array.isArray(fixedCosts)) {
        const fallbackWhere = fixedFilter.whereClause ? `WHERE ${fixedFilter.whereClause}` : "";
        fixedCosts = await safeQuery(
            conexion,
            `SELECT cf.*, cf.${costoFijoIdColumn} AS id, s.nombre as servicio_nombre
             FROM costos_fijos cf
             LEFT JOIN servicios s ON cf.${costoFijoServicioColumn} = s.${servicioIdColumn}
             ${fallbackWhere}`,
            fixedFilter.params,
            []
        );
    }

    const fixedItems = (Array.isArray(fixedCosts) ? fixedCosts : [])
        .map((cost) => {
            const dueDate = computeNextFixedDueDate(cost, today);
            if (!dueDate) return null;
            return {
                id: `fijo-${cost.id}`,
                tipo: "fijo",
                referencia_id: Number(cost.id),
                titulo: cost.servicio_nombre || cost.proveedor || "Costo fijo",
                concepto: cost.notas || null,
                frecuencia: cost.frecuencia || "Mensual",
                fecha_vencimiento: toSqlDate(dueDate),
                dias_restantes: diffDays(today, dueDate),
                monto: Number(cost.monto || 0)
            };
        })
        .filter(Boolean);

    let variableItems = [];
    try {
        const variableFilter = await getCostosVariablesNotDeletedFilter(conexion);
        const variableWhere = ["fecha_vencimiento IS NOT NULL"];
        const variableParams = [];
        if (variableFilter.whereClause) {
            variableWhere.push(variableFilter.whereClause);
            variableParams.push(...variableFilter.params);
        }

        const variableCosts = await conexion.ejecutarQuery(
            `SELECT ${costoVariableIdColumn} AS id, concepto, monto, fecha_vencimiento, observaciones
             FROM costos_variables
             WHERE ${variableWhere.join(" AND ")}`,
            variableParams
        );

        variableItems = (Array.isArray(variableCosts) ? variableCosts : [])
            .map((cost) => {
                const dueDate = normalizeDate(cost.fecha_vencimiento);
                if (!dueDate) return null;
                return {
                    id: `variable-${cost.id}`,
                    tipo: "variable",
                    referencia_id: Number(cost.id),
                    titulo: cost.concepto || "Costo variable",
                    concepto: cost.observaciones || null,
                    frecuencia: "Puntual",
                    fecha_vencimiento: toSqlDate(dueDate),
                    dias_restantes: diffDays(today, dueDate),
                    monto: Number(cost.monto || 0)
                };
            })
            .filter(Boolean);
    } catch (_) {
        variableItems = [];
    }

    const allItems = [...fixedItems, ...variableItems]
        .filter((item) => {
            const due = normalizeDate(item.fecha_vencimiento);
            return due && due <= limitDate;
        })
        .sort((a, b) => {
            const aDate = normalizeDate(a.fecha_vencimiento)?.getTime() || 0;
            const bDate = normalizeDate(b.fecha_vencimiento)?.getTime() || 0;
            return aDate - bDate;
        });

    return {
        from: toSqlDate(today),
        to: toSqlDate(limitDate),
        dias: windowDays,
        total: allItems.length,
        items: allItems
    };
}
