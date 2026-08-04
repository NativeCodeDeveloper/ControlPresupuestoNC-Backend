/**
 * healthScoreService.js
 *
 * Servicio de lógica de negocio para Health Score.
 *
 * Responsabilidades:
 * - Obtener clientes con sus métricas de Finance
 * - Llamar a Agenda Clínica para métricas de uso
 * - Calcular Health Score usando la calculadora
 * - Guardar historial (cuando exista tabla)
 */

import DataBase from '../config/Database.js';
import Proyectos from '../model/Proyectos.js';
import { decryptApiKey } from '../utils/encryption.js';
import { getMRRyARPA, getChurnSnapshot } from '../model/MetricasNegocio.js';

const db = () => DataBase.getInstance();

// Estados de proyectos (desde model/Proyectos.js)
const ESTADO_CANCELADO = 6;
const ESTADO_DESACTIVADA = 9;

// Filtro para clientes activos (recurrentes, no cancelados)
const CLIENTE_ACTIVO_FILTER = `
  activo = 1
  AND ciclo_facturacion != 'Unico'
  AND id_estado_proyecto NOT IN (${ESTADO_CANCELADO}, ${ESTADO_DESACTIVADA})
  AND (observaciones IS NULL OR observaciones NOT LIKE '[ELIMINADO]#%')
`;

/**
 * Obtiene clientes cancelados con fecha de cancelación
 */
async function getCancelledClients() {
  try {
    const hasFechaCancelacion = await _hasColumn('proyectos', 'fecha_cancelacion');

    let query = `
      SELECT
        nombre_cliente,
        MAX(fecha_cancelacion) AS fecha_cancelacion,
        SUM(monto_acordado) AS monto_total
      FROM proyectos
      WHERE activo = 1
        AND (observaciones IS NULL OR observaciones NOT LIKE '[ELIMINADO]#%')
        AND id_estado_proyecto = ${ESTADO_CANCELADO}
    `;

    if (!hasFechaCancelacion) {
      query += ` GROUP BY nombre_cliente`;
    } else {
      query += ` GROUP BY nombre_cliente ORDER BY fecha_cancelacion DESC`;
    }

    const rows = await db().ejecutarQuery(query, []);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('[healthScoreService.getCancelledClients]', error);
    return [];
  }
}

/**
 * Obtiene configuración de Agenda Clínica para un cliente.
 * Devuelve la URL del backend y la API key desencriptada.
 *
 * @param {string} nombreCliente - Nombre del cliente
 * @returns {Object|null} { ruta_backend, api_key } o null si no existe
 */
async function getClientConfig(nombreCliente) {
  try {
    const rows = await db().ejecutarQuery(`
      SELECT s.ruta_backend, s.api_key_encrypted
      FROM synapse_servidores s
      INNER JOIN proyectos p ON s.id_proyecto = p.id_proyecto
      WHERE p.nombre_cliente = ?
        AND s.ruta_backend IS NOT NULL
        AND s.ruta_backend != ''
      LIMIT 1
    `, [nombreCliente]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const config = rows[0];

    // Desencriptar API key (solo en memoria)
    let apiKey = null;
    if (config.api_key_encrypted) {
      try {
        apiKey = decryptApiKey(config.api_key_encrypted);
      } catch (error) {
        console.error(`[healthScoreService.getClientConfig] Error desencriptando API key para ${nombreCliente}:`, error.message);
        // Continuar sin API key
      }
    }

    return {
      ruta_backend: config.ruta_backend,
      api_key: apiKey,
    };
  } catch (error) {
    console.error('[healthScoreService.getClientConfig]', error);
    return null;
  }
}

/**
 * Obtiene los proyectos activos (con datos de pago) de uno o todos los
 * clientes activos en una sola query — evita N+1 al calcular métricas de
 * varios clientes a la vez (ver getAllScores).
 *
 * @param {string|null} nombreCliente - si se pasa, filtra a un solo cliente
 */
// monto_acordado normalizado a equivalente ANUAL — "cuánto perderíamos si
// este cliente se va" en un año, no solo su cuota del mes. Mismo criterio de
// ciclo_facturacion que MetricasNegocio.js (MRR_CASE), llevado a anual.
const MONTO_ANUAL_CASE = `
  CASE ciclo_facturacion
    WHEN 'Mensual'    THEN monto_acordado * 12
    WHEN 'Trimestral' THEN monto_acordado * 4
    WHEN 'Anual'      THEN monto_acordado
    ELSE 0
  END
`;

async function _getProyectosFinancieros(nombreCliente = null) {
  const params = [];
  let where = CLIENTE_ACTIVO_FILTER;
  if (nombreCliente) {
    where += ` AND nombre_cliente = ?`;
    params.push(nombreCliente);
  }

  const rows = await db().ejecutarQuery(`
    SELECT id_proyecto, nombre_cliente, ciclo_facturacion, fecha_proximo_pago,
           ${MONTO_ANUAL_CASE} AS monto_anual
    FROM proyectos
    WHERE ${where}
  `, params);

  return Array.isArray(rows) ? rows : [];
}

/**
 * Techo para "Valor facturado" = LTV real del negocio (ARPA ÷ Churn Rate),
 * la misma fórmula que ya usa /clientes/metricas (MetricasController.js) —
 * no se inventa un multiplicador nuevo acá. Si mejora el cálculo de LTV allá
 * (ej. con historial real de cancelación), este techo mejora solo con eso.
 * Fallback: si no hay churn registrado (churnRate 0), un año de ARPA.
 */
async function _getValorCeiling() {
  const [mrrArpa, churn] = await Promise.all([getMRRyARPA(), getChurnSnapshot()]);

  if (churn.churnRate > 0) {
    return Math.round(mrrArpa.arpa / churn.churnRate);
  }
  return Math.round(mrrArpa.arpa * 12) || 1200000;
}

/**
 * De un set de id_proyecto, cuáles tienen al menos un DTE rechazado sin
 * resolver — batched, no uno por proyecto.
 */
async function _getProyectosConDteRechazado(idsProyecto) {
  if (!idsProyecto.length) return new Set();

  const placeholders = idsProyecto.map(() => '?').join(',');
  const rows = await db().ejecutarQuery(`
    SELECT DISTINCT id_proyecto
    FROM dte_documentos
    WHERE activo = 1 AND estado_sii = 'rechazado' AND id_proyecto IN (${placeholders})
  `, idsProyecto);

  return new Set((Array.isArray(rows) ? rows : []).map(r => r.id_proyecto));
}

/**
 * Agrega las filas de proyectos de UN cliente en métricas financieras.
 * estadoPagos/morosidad usan el peor caso (fecha_proximo_pago más próxima a
 * vencer o ya vencida) entre sus proyectos con ciclo recurrente — mismo
 * criterio que ya usa el Cockpit (Synapse.getCockpitData) para no inventar
 * un segundo criterio de "cliente atrasado".
 */
function _aggregateFinanceMetrics(proyectosCliente, dteRechazadoIds) {
  const montoFacturado = proyectosCliente.reduce((sum, p) => sum + Number(p.monto_anual || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let peorDiff = null;
  for (const p of proyectosCliente) {
    if (p.ciclo_facturacion && p.ciclo_facturacion !== 'Unico' && p.fecha_proximo_pago) {
      const vence = new Date(p.fecha_proximo_pago);
      vence.setHours(0, 0, 0, 0);
      const diff = Math.floor((vence - today) / 86400000);
      if (peorDiff === null || diff < peorDiff) peorDiff = diff;
    }
  }

  let estadoPagos = 'verde';
  let morosidad = 0;
  if (peorDiff !== null) {
    if (peorDiff < 0) {
      estadoPagos = 'rojo';
      morosidad = -peorDiff;
    } else if (peorDiff <= 7) {
      estadoPagos = 'naranja';
    }
  }

  const dtesAlDia = !proyectosCliente.some(p => dteRechazadoIds.has(p.id_proyecto));

  return { estadoPagos, morosidad, dtesAlDia, montoFacturado };
}

/**
 * Obtiene métricas financieras de un cliente
 * (estado de pagos, morosidad, DTEs, valor facturado)
 */
async function getClientFinanceMetrics(nombreCliente) {
  try {
    const proyectos = await _getProyectosFinancieros(nombreCliente);
    if (!proyectos.length) {
      return { estadoPagos: 'naranja', morosidad: 0, dtesAlDia: true, montoFacturado: 0 };
    }

    const ids = proyectos.map(p => p.id_proyecto);
    const dteRechazadoIds = await _getProyectosConDteRechazado(ids);

    return _aggregateFinanceMetrics(proyectos, dteRechazadoIds);
  } catch (error) {
    console.error('[healthScoreService.getClientFinanceMetrics]', error);
    return {
      estadoPagos: 'desconocido',
      morosidad: 0,
      dtesAlDia: true,
      montoFacturado: 0,
    };
  }
}

// ── Cálculo de score (PAGA — USO pendiente de Agenda Clínica) ─────────────
//
// Mientras Agenda Clínica no esté conectada, el status se calcula con
// comportamiento de pago (estadoPagos + morosidad): esto SÍ es un status
// real y accionable para priorizar (cliente atrasado en pago sale
// crítico/en riesgo de verdad), no un placeholder.
//
// dtesAlDia queda FUERA del score por ahora — pedido explícito del usuario:
// la verificación de DTE todavía no está integrada para este flujo, así que
// no es un dato confiable para pesar en el status. Se sigue mostrando en la
// tarjeta (bloque Pagos) como informativo, solo que no cuenta. Reactivar
// agregándolo de vuelta a SCORE_WEIGHTS cuando esté listo.
//
// valorFacturado SÍ entra al score, pero con peso chico (15) a propósito:
// se probó con su peso "de manual" (20/40 ≈ 57% de lo que hoy pesa) y un
// cliente con pago atrasado de verdad (rojo) terminaba viéndose "Saludable"
// solo por ser un cliente grande — el tamaño tapaba el atraso, exactamente
// lo que "status real basado en pagos" quería evitar. Con 15% aporta sin
// poder sacar de crítico/en riesgo a nadie que esté realmente atrasado.
//
// El loop de abajo normaliza por la SUMA de los pesos presentes (no asume
// que sumen 100) — así sacar/meter una métrica del score no rompe el techo
// de 100 puntos ni obliga a recalcular a mano el resto de los pesos.
//
// DTES_DISPLAY_WEIGHT es el peso original de dtesAlDia en
// control-Front/.../healthScoreConstants.js — solo para mostrar su barra en
// la UI (en gris, countsTowardScore:false), no pesa en el score. Cuando se
// conecte Agenda Clínica, reemplazar SCORE_WEIGHTS por el cálculo completo
// (USO+VALOR+PAGA) con los pesos originales — ver _fetchAgendaClinicaMetrics
// más abajo, ya dejado listo para activar.
const SCORE_WEIGHTS = { estadoPagos: 57, morosidad: 28, valorFacturado: 15 };
const DTES_DISPLAY_WEIGHT = 5;
const SCORE_THRESHOLDS = { HEALTHY: 70, WARNING: 40 };

function _normalizeValorFacturado(monto, ceiling) {
  return Math.round(Math.min(100, (Math.sqrt(monto) / Math.sqrt(ceiling)) * 100));
}

function _normalizeEstadoPagos(estado) {
  return { verde: 100, naranja: 50, rojo: 0 }[estado] ?? 50;
}

function _normalizeMorosidad(dias) {
  const max = 90;
  if (dias <= 0) return 100;
  if (dias >= max) return 0;
  return Math.round(100 - (dias / max) * 100);
}

function _normalizeDtesAlDia(alDia) {
  return alDia ? 100 : 0;
}

// Métricas de USO en placeholder — Agenda Clínica todavía no está conectada.
// Se muestran igual (con sus pesos reales) para que la UI ya tenga la
// estructura lista; cuando _fetchAgendaClinicaMetrics se active, este bloque
// se reemplaza por los valores reales y empiezan a sumar solas al score.
//
// Rediseñado a propósito para detectar churn TEMPRANO, no un mes tarde:
// un acumulado de "reservas últimos 30 días" como señal principal es lento
// — un cliente puede dejar de usar la plataforma y recién se ve "mal" en el
// health score casi un mes después, cuando probablemente ya decidió irse.
// diasSinActividad (recencia) y tendenciaSemanal (¿la actividad está
// cayendo AHORA?) pasan a ser las señales dominantes (60% combinado); los
// acumulados mensuales quedan como contexto de volumen, no como alerta.
const USO_WEIGHTS = {
  diasSinActividad: 35,
  tendenciaSemanal: 25,
  reservas: 15,
  confirmaciones: 15,
  fichasClinicas: 10,
};

function _buildUsoPlaceholderMetrics() {
  return {
    diasSinActividad: {
      id: 'diasSinActividad', label: 'Días sin actividad', category: 'uso',
      value: null, weight: USO_WEIGHTS.diasSinActividad,
      maxPossible: 60, normalizedValue: 0, contribution: 0, unit: 'días sin reservar/ingresar',
    },
    tendenciaSemanal: {
      id: 'tendenciaSemanal', label: 'Tendencia semanal', category: 'uso',
      value: null, weight: USO_WEIGHTS.tendenciaSemanal,
      maxPossible: 0, normalizedValue: 0, contribution: 0, unit: '% vs semana anterior',
    },
    reservas: {
      id: 'reservas', label: 'Reservas', category: 'uso',
      value: 0, weight: USO_WEIGHTS.reservas,
      maxPossible: 150, normalizedValue: 0, contribution: 0, unit: 'últimos 30 días',
    },
    confirmaciones: {
      id: 'confirmaciones', label: 'Confirmaciones', category: 'uso',
      value: 0, weight: USO_WEIGHTS.confirmaciones,
      maxPossible: 100, normalizedValue: 0, contribution: 0, unit: '%',
    },
    fichasClinicas: {
      id: 'fichasClinicas', label: 'Fichas clínicas', category: 'uso',
      value: 0, weight: USO_WEIGHTS.fichasClinicas,
      maxPossible: 120, normalizedValue: 0, contribution: 0, unit: 'creadas',
    },
  };
}

function _buildFinanceScore(finance, valorCeiling) {
  const normalized = {
    valorFacturado: _normalizeValorFacturado(finance.montoFacturado || 0, valorCeiling),
    estadoPagos: _normalizeEstadoPagos(finance.estadoPagos),
    morosidad: _normalizeMorosidad(finance.morosidad || 0),
    dtesAlDia: _normalizeDtesAlDia(finance.dtesAlDia),
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    weightedSum += normalized[key] * weight;
    totalWeight += weight;
  }
  const score = Math.round(weightedSum / totalWeight);

  let status = 'critical';
  if (score >= SCORE_THRESHOLDS.HEALTHY) status = 'healthy';
  else if (score >= SCORE_THRESHOLDS.WARNING) status = 'warning';

  // Métricas que SÍ pesan en el score muestran su peso REAL (normalizado a
  // 100 entre lo que efectivamente cuenta hoy — ver SCORE_WEIGHTS). Las que
  // no pesan (dtesAlDia, USO) se marcan con countsTowardScore:false para que
  // la UI las pinte en gris — mostrarles un % ahí sería engañoso.
  const scoreWeightPercent = (key) => Math.round((SCORE_WEIGHTS[key] / totalWeight) * 100);

  const metrics = {
    valorFacturado: {
      id: 'valorFacturado', label: 'Valor facturado', category: 'valor',
      value: finance.montoFacturado || 0, weight: scoreWeightPercent('valorFacturado'),
      maxPossible: valorCeiling, normalizedValue: normalized.valorFacturado,
      contribution: Math.round((normalized.valorFacturado * scoreWeightPercent('valorFacturado')) / 100),
      unit: '$', countsTowardScore: true,
    },
    estadoPagos: {
      id: 'estadoPagos', label: 'Estado de pagos', category: 'paga',
      value: finance.estadoPagos, weight: scoreWeightPercent('estadoPagos'),
      maxPossible: 1, normalizedValue: normalized.estadoPagos,
      contribution: Math.round((normalized.estadoPagos * scoreWeightPercent('estadoPagos')) / 100),
      unit: '', countsTowardScore: true,
    },
    morosidad: {
      id: 'morosidad', label: 'Morosidad', category: 'paga',
      value: finance.morosidad || 0, weight: scoreWeightPercent('morosidad'),
      maxPossible: 90, normalizedValue: normalized.morosidad,
      contribution: Math.round((normalized.morosidad * scoreWeightPercent('morosidad')) / 100),
      unit: 'días atraso', countsTowardScore: true,
    },
    dtesAlDia: {
      id: 'dtesAlDia', label: 'DTEs al día', category: 'paga',
      value: finance.dtesAlDia, weight: DTES_DISPLAY_WEIGHT,
      maxPossible: 1, normalizedValue: normalized.dtesAlDia,
      contribution: Math.round((normalized.dtesAlDia * DTES_DISPLAY_WEIGHT) / 100),
      unit: '', countsTowardScore: false,
    },
  };

  const usoMetrics = Object.fromEntries(
    Object.entries(_buildUsoPlaceholderMetrics()).map(([k, m]) => [k, { ...m, countsTowardScore: false }])
  );

  return { score, status, metrics: { ...usoMetrics, ...metrics } };
}

/**
 * Trae métricas de USO desde el backend independiente de Agenda Clínica del
 * cliente (config.ruta_backend + config.api_key, ya cifrado/gestionado por
 * getClientConfig). NO ACTIVAR hasta que Agenda Clínica exponga este
 * endpoint — hoy no existe y fallarían todas las llamadas. Ver especificación
 * completa en docs/agenda-clinica-health-metrics.md (contrato para Nico).
 *
 * NO llamar esto en vivo en cada getScore/getAllScores — 32+ clientes
 * significan 32+ llamadas HTTP a servidores externos distintos en cada
 * carga de página; si uno está lento o caído, se atrasa/rompe toda la
 * página. Debe ir en un cron propio (mismo patrón que
 * capturePortfolioSnapshot) que guarde el resultado en una tabla de caché
 * acá en Finance, y getScore/getAllScores lee de esa caché, nunca en vivo.
 */
// async function _fetchAgendaClinicaMetrics(config) {
//   const res = await fetch(`${config.ruta_backend}/health-metrics`, {
//     headers: {
//       Authorization: `Bearer ${config.api_key}`,
//       Accept: 'application/json',
//     },
//   });
//   if (!res.ok) throw new Error(`Agenda Clínica respondió ${res.status}`);
//   const data = await res.json();
//   // Forma esperada (ver docs/agenda-clinica-health-metrics.md):
//   // { diasSinActividad, tendenciaSemanal, reservas, confirmaciones, fichasClinicas }
//   return data;
// }

/**
 * Obtiene Health Score de todos los clientes
 * @param {string} filter - 'activos' | 'cancelados'
 */
export async function getAllScores(filter = 'activos') {
  try {
    if (filter === 'cancelados') {
      const clients = await getCancelledClients();

      // TODO: Obtener historial de métricas antes de cancelación
      return clients.map(c => ({
        clientId: c.nombre_cliente,
        companyName: c.nombre_cliente,
        fechaCancelacion: c.fecha_cancelacion,
        lastScore: null, // TODO: obtener desde historial
        metrics: [],
      }));
    }

    // Activos — una sola query para todos los proyectos + una para DTEs
    // rechazados (batched, no una consulta por cliente).
    const proyectos = await _getProyectosFinancieros();

    const porCliente = new Map();
    for (const p of proyectos) {
      if (!porCliente.has(p.nombre_cliente)) porCliente.set(p.nombre_cliente, []);
      porCliente.get(p.nombre_cliente).push(p);
    }

    const [dteRechazadoIds, valorCeiling] = await Promise.all([
      _getProyectosConDteRechazado(proyectos.map(p => p.id_proyecto)),
      _getValorCeiling(),
    ]);

    const financeByClient = new Map();
    for (const [nombreCliente, proyectosCliente] of porCliente) {
      financeByClient.set(nombreCliente, _aggregateFinanceMetrics(proyectosCliente, dteRechazadoIds));
    }

    return Array.from(financeByClient.entries()).map(([nombreCliente, finance]) => {
      const { score, status, metrics } = _buildFinanceScore(finance, valorCeiling);

      return {
        clientId: nombreCliente,
        companyName: nombreCliente,
        score,
        status,
        metrics,
        calculatedAt: new Date(),
      };
    });
  } catch (error) {
    console.error('[healthScoreService.getAllScores]', error);
    throw error;
  }
}

/**
 * Obtiene Health Score de un cliente específico, basado en lo que Finance ya
 * sabe (pagos + valor). Cuando Agenda Clínica esté conectada, sumar USO acá
 * (ver _fetchAgendaClinicaMetrics).
 */
export async function getScore(clientId) {
  try {
    // Config de Agenda Clínica ya lista (URL + API key cifrada), sin usar
    // todavía — queda a la espera de que Agenda Clínica exponga /health.
    const config = await getClientConfig(clientId);

    const [finance, valorCeiling] = await Promise.all([
      getClientFinanceMetrics(clientId),
      _getValorCeiling(),
    ]);
    const { score, status, metrics } = _buildFinanceScore(finance, valorCeiling);

    return {
      clientId,
      companyName: clientId,
      score,
      status,
      metrics,
      config: {
        hasBackend: !!config?.ruta_backend,
        hasApiKey: !!config?.api_key,
      },
      calculatedAt: new Date(),
    };
  } catch (error) {
    console.error('[healthScoreService.getScore]', error);
    throw error;
  }
}

/**
 * Obtiene historial de Health Score
 * TODO: Implementar cuando exista tabla de historial
 */
export async function getHistory(clientId, months = 6) {
  // TODO: Implementar
  return [];
}

/**
 * Obtiene estadísticas agregadas
 */
export async function getStats() {
  try {
    const [scores, cancelados] = await Promise.all([
      getAllScores('activos'),
      getCancelledClients(),
    ]);

    return {
      total: scores.length,
      healthy: scores.filter(s => s.status === 'healthy').length,
      warning: scores.filter(s => s.status === 'warning').length,
      critical: scores.filter(s => s.status === 'critical').length,
      cancelled: cancelados.length,
    };
  } catch (error) {
    console.error('[healthScoreService.getStats]', error);
    throw error;
  }
}

/**
 * Guarda (o actualiza) el snapshot de HOY con la distribución actual de
 * cartera. Idempotente — se puede llamar varias veces el mismo día (el cron
 * corre cada 6h) sin generar duplicados, gracias al UNIQUE KEY en `fecha`;
 * cada llamada simplemente deja el snapshot más reciente de ese día.
 * Requiere la tabla health_score_historial (ver migrations/health_score_historial.sql).
 */
export async function capturePortfolioSnapshot() {
  try {
    const stats = await getStats();
    const fecha = new Date().toISOString().slice(0, 10);

    await db().ejecutarQuery(`
      INSERT INTO health_score_historial (fecha, total, healthy, warning, critical, cancelled)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total = VALUES(total),
        healthy = VALUES(healthy),
        warning = VALUES(warning),
        critical = VALUES(critical),
        cancelled = VALUES(cancelled)
    `, [fecha, stats.total, stats.healthy, stats.warning, stats.critical, stats.cancelled]);

    return { ok: true, fecha, stats };
  } catch (error) {
    console.error('[healthScoreService.capturePortfolioSnapshot]', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Historial de distribución de cartera para graficar tendencia.
 * @param {number} days - cuántos días hacia atrás traer (default 90)
 */
export async function getPortfolioHistory(days = 90) {
  try {
    const rows = await db().ejecutarQuery(`
      SELECT fecha, total, healthy, warning, critical, cancelled
      FROM health_score_historial
      WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY fecha ASC
    `, [days]);

    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    // Tabla puede no existir todavía si la migración no se aplicó — no
    // romper el resto del feature por esto, solo devolver vacío.
    console.error('[healthScoreService.getPortfolioHistory]', error);
    return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function _hasColumn(table, column) {
  try {
    const rows = await db().ejecutarQuery(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `, [table, column]);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export default {
  getAllScores,
  getScore,
  getHistory,
  getStats,
  getClientConfig,
  capturePortfolioSnapshot,
  getPortfolioHistory,
};
