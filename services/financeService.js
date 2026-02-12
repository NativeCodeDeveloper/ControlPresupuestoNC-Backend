import DataBase from "../config/Database.js";

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

    // Si el costo inicia dentro del período seleccionado, se considera gasto del período.
    if (start && start >= periodStart && start <= periodEnd) return true;

    const dueDate = computeNextFixedDueDate(cost, periodStart);
    if (!dueDate) return false;
    return dueDate >= periodStart && dueDate <= periodEnd;
}

function computeNextFixedDueDate(cost, referenceDate = new Date()) {
    const ref = normalizeDate(referenceDate);
    const start = normalizeDate(cost?.fecha_inicio) || ref;
    const end = normalizeDate(cost?.fecha_fin);
    const paymentDay = Number(cost?.fecha_pago || start.getDate());
    const stepMonths = getFrequencyStepMonths(cost?.frecuencia);

    let due = buildDateInMonth(start.getFullYear(), start.getMonth(), paymentDay);
    if (due < start) {
        const moved = addMonths(start.getFullYear(), start.getMonth(), stepMonths);
        due = buildDateInMonth(moved.year, moved.monthIndex, paymentDay);
    }

    while (due < ref) {
        const moved = addMonths(due.getFullYear(), due.getMonth(), stepMonths);
        due = buildDateInMonth(moved.year, moved.monthIndex, paymentDay);
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
    const rows = await safeQuery(
        conexion,
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName],
        []
    );

    return new Set(
        (Array.isArray(rows) ? rows : [])
            .map((r) => String(r.COLUMN_NAME || "").trim())
            .filter(Boolean)
    );
}

async function getFixedCostsData(conexion) {
    const columns = await getTableColumns(conexion, "costos_fijos");

    const hasFechaInicio = columns.has("fecha_inicio");
    const hasFechaFin = columns.has("fecha_fin");
    const hasFrecuencia = columns.has("frecuencia");
    const hasFechaPago = columns.has("fecha_pago");

    const selectFrecuencia = hasFrecuencia ? "frecuencia" : "'Mensual' AS frecuencia";
    const selectFechaPago = hasFechaPago ? "fecha_pago" : "1 AS fecha_pago";
    const selectFechaInicio = hasFechaInicio ? "fecha_inicio" : "NULL AS fecha_inicio";
    const selectFechaFin = hasFechaFin ? "fecha_fin" : "NULL AS fecha_fin";

    return safeQuery(
        conexion,
        `SELECT id, monto, ${selectFrecuencia}, ${selectFechaPago}, ${selectFechaInicio}, ${selectFechaFin}
         FROM costos_fijos`,
        [],
        []
    );
}

async function getInvestmentSums(conexion, startDate, endDate) {
    const hasRange = Boolean(startDate && endDate);
    const rangeClause = hasRange ? "WHERE fecha_inversion BETWEEN ? AND ?" : "";
    const params = hasRange ? [startDate, endDate] : [];

    try {
        const [row] = await conexion.ejecutarQuery(
            `SELECT
                COALESCE(SUM(CASE WHEN fondo_origen = 'reinversion' THEN monto ELSE 0 END), 0) AS reinversion,
                COALESCE(SUM(CASE WHEN fondo_origen = 'emergencia' THEN monto ELSE 0 END), 0) AS emergencia,
                COALESCE(SUM(monto), 0) AS total
             FROM inversiones
             ${rangeClause}`,
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
                `SELECT COALESCE(SUM(monto), 0) AS total FROM inversiones ${rangeClause}`,
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

    const [costosVariables] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM costos_variables WHERE fecha BETWEEN ? AND ?",
        [startDate, endDate],
        [{}]
    );

    const totalFixedCosts = (Array.isArray(fixedCostsData) ? fixedCostsData : [])
        .filter((cost) => fixedCostOccursInPeriod(cost, year, month - 1))
        .reduce((sum, cost) => {
            const amount = Number.parseFloat(cost?.monto);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

    const income = Number(ingresos?.total || 0);
    const variable = Number(costosVariables?.total || 0);
    const base = Math.max(0, income - totalFixedCosts - variable);

    const [config] = await safeQuery(
        conexion,
        "SELECT porcentaje_fondo_emergencia, porcentaje_reinversion FROM configuracion_financiera WHERE id = 1",
        [],
        [{}]
    );

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

export async function getFinancialSummary(query = {}) {
    const conexion = DataBase.getInstance();
    const period = getPeriodFromQuery(query);

    const [ingresos] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM proyecto_pagos WHERE fecha_pago BETWEEN ? AND ?",
        [period.startDate, period.endDate],
        [{}]
    );

    const costosFijosData = await getFixedCostsData(conexion);

    const [costosVariables] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM costos_variables WHERE fecha BETWEEN ? AND ?",
        [period.startDate, period.endDate],
        [{}]
    );

    const [retirosMes] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM retiros_socios WHERE fecha_retiro BETWEEN ? AND ?",
        [period.startDate, period.endDate],
        [{}]
    );

    const [config] = await safeQuery(
        conexion,
        "SELECT porcentaje_fondo_emergencia, porcentaje_reinversion FROM configuracion_financiera WHERE id = 1",
        [],
        [{}]
    );

    const inversionesPeriodo = await getInvestmentSums(conexion, period.startDate, period.endDate);

    const totalIncome = Number(ingresos?.total || 0);
    const totalFixedCosts = (Array.isArray(costosFijosData) ? costosFijosData : [])
        .filter((cost) => fixedCostOccursInPeriod(cost, period.year, period.month - 1))
        .reduce((sum, cost) => {
            const amount = Number.parseFloat(cost?.monto);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
    const totalVariableCosts = Number(costosVariables?.total || 0);
    const totalExpenses = totalFixedCosts + totalVariableCosts;

    const operatingResult = totalIncome - totalExpenses;
    const baseForDeductions = Math.max(0, operatingResult);

    const emergencyPct = Number(config?.porcentaje_fondo_emergencia || 0);
    const reinvestPct = Number(config?.porcentaje_reinversion || 0);

    const emergencyFundDeduction = (baseForDeductions * emergencyPct) / 100;
    const reinvestmentDeduction = (baseForDeductions * reinvestPct) / 100;

    // Las inversiones consumen fondos ya deducidos (no se descuentan 2 veces del neto socios).
    const netProfit = operatingResult - emergencyFundDeduction - reinvestmentDeduction;
    const fondos = await getFondosSaldos(conexion);

    return {
        period,
        config: {
            porcentaje_fondo_emergencia: emergencyPct,
            porcentaje_reinversion: reinvestPct
        },
        income: totalIncome,
        fixedCosts: totalFixedCosts,
        variableCosts: totalVariableCosts,
        expenses: totalExpenses,
        operatingResult,
        emergencyFundDeduction,
        reinvestmentDeduction,
        netProfit,
        withdrawals: Number(retirosMes?.total || 0),
        investments: inversionesPeriodo,
        fondos
    };
}

export async function getPartnerAvailableAmount(socioId, query = {}) {
    const conexion = DataBase.getInstance();
    const summary = await getFinancialSummary(query);

    const [socio] = await safeQuery(
        conexion,
        "SELECT id, nombre, porcentaje_participacion FROM socios WHERE id = ?",
        [socioId],
        []
    );

    if (!socio) {
        return null;
    }

    const assigned = Math.max(0, (summary.netProfit * Number(socio.porcentaje_participacion || 0)) / 100);
    const [retiros] = await safeQuery(
        conexion,
        "SELECT COALESCE(SUM(monto), 0) AS total FROM retiros_socios WHERE socio_id = ? AND fecha_retiro BETWEEN ? AND ?",
        [socioId, summary.period.startDate, summary.period.endDate],
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

    let fixedCosts = await safeQuery(
        conexion,
        `SELECT cf.*, s.nombre as servicio_nombre
         FROM costos_fijos cf
         LEFT JOIN servicios s ON cf.servicio_id = s.id
         WHERE cf.fecha_fin IS NULL OR cf.fecha_fin >= CURDATE()`,
        [],
        null
    );

    if (!Array.isArray(fixedCosts)) {
        fixedCosts = await safeQuery(
            conexion,
            `SELECT cf.*, s.nombre as servicio_nombre
             FROM costos_fijos cf
             LEFT JOIN servicios s ON cf.servicio_id = s.id`,
            [],
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
        const variableCosts = await conexion.ejecutarQuery(
            `SELECT id, concepto, monto, fecha_vencimiento, observaciones
             FROM costos_variables
             WHERE fecha_vencimiento IS NOT NULL`
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
