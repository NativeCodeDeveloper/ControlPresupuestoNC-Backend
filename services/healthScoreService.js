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
// valorFacturado tampoco entra al score — ver getValorCeiling: su techo es
// el LTV real del negocio, pensado para leerse solo como referencia, no
// como parte de "cliente paga o no paga" (el pedido explícito fue "status
// real basado en pagos").
//
// El loop de abajo normaliza por la SUMA de los pesos presentes (no asume
// que sumen 100) — así sacar/meter una métrica del score no rompe el techo
// de 100 puntos ni obliga a recalcular a mano el resto de los pesos.
//
// DISPLAY_WEIGHTS son los pesos originales de
// control-Front/.../healthScoreConstants.js (incluye valorFacturado 20 y
// dtesAlDia 5) — solo para mostrar en las barras de la UI, no para el
// score. Cuando se conecte Agenda Clínica, reemplazar SCORE_WEIGHTS por el
// cálculo completo (USO+VALOR+PAGA) con los pesos originales — ver
// _fetchAgendaClinicaMetrics más abajo, ya dejado listo para activar.
const SCORE_WEIGHTS = { estadoPagos: 2, morosidad: 1 };
const DISPLAY_WEIGHTS = { valorFacturado: 20, estadoPagos: 10, morosidad: 5, dtesAlDia: 5 };
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

// Métricas de USO en 0 — Agenda Clínica todavía no está conectada. Se
// muestran igual (con sus pesos reales) para que la UI ya tenga la
// estructura lista; cuando _fetchAgendaClinicaMetrics se active, este bloque
// se reemplaza por los valores reales y empiezan a sumar solas al score.
const USO_WEIGHTS = { reservas: 35, confirmaciones: 20, fichasClinicas: 20, ultimoIngreso: 15, frecuenciaIngreso: 10 };

function _buildUsoPlaceholderMetrics() {
  return {
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
    ultimoIngreso: {
      id: 'ultimoIngreso', label: 'Último ingreso', category: 'uso',
      value: null, weight: USO_WEIGHTS.ultimoIngreso,
      maxPossible: 90, normalizedValue: 0, contribution: 0, unit: 'días atrás',
    },
    frecuenciaIngreso: {
      id: 'frecuenciaIngreso', label: 'Frecuencia de ingreso', category: 'uso',
      value: null, weight: USO_WEIGHTS.frecuenciaIngreso,
      maxPossible: 30, normalizedValue: 0, contribution: 0, unit: 'días entre ingresos',
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
  // 100 entre lo que efectivamente cuenta hoy — ver SCORE_WEIGHTS), no el
  // peso "de exhibición" del modelo completo. Las que no pesan (valorFacturado,
  // dtesAlDia, USO) se marcan con countsTowardScore:false para que la UI las
  // pinte en gris — mostrarles un % ahí sería engañoso.
  const scoreWeightPercent = (key) => Math.round((SCORE_WEIGHTS[key] / totalWeight) * 100);
  const contribution = (key) => Math.round((normalized[key] * DISPLAY_WEIGHTS[key]) / 100);

  const metrics = {
    valorFacturado: {
      id: 'valorFacturado', label: 'Valor facturado', category: 'valor',
      value: finance.montoFacturado || 0, weight: DISPLAY_WEIGHTS.valorFacturado,
      maxPossible: valorCeiling, normalizedValue: normalized.valorFacturado,
      contribution: contribution('valorFacturado'), unit: '$', countsTowardScore: false,
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
      value: finance.dtesAlDia, weight: DISPLAY_WEIGHTS.dtesAlDia,
      maxPossible: 1, normalizedValue: normalized.dtesAlDia,
      contribution: contribution('dtesAlDia'), unit: '', countsTowardScore: false,
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
 * getClientConfig). NO ACTIVAR hasta que Agenda Clínica exponga estos
 * endpoints (ver README del módulo en control-Front) — hoy no existen y
 * fallarían todas las llamadas.
 *
 * Uso previsto una vez esté listo (en getScore/getAllScores):
 *   const config = await getClientConfig(nombreCliente);
 *   if (config?.ruta_backend && config?.api_key) {
 *     const uso = await _fetchAgendaClinicaMetrics(config);
 *     // fusionar `uso` con `finance` y pasar ambos a un cálculo de score
 *     // completo (USO+VALOR+PAGA) con los pesos originales sin reescalar.
 *   }
 */
// async function _fetchAgendaClinicaMetrics(config) {
//   const res = await fetch(`${config.ruta_backend}/api/v1/companies/health`, {
//     headers: {
//       Authorization: `Bearer ${config.api_key}`,
//       Accept: 'application/json',
//     },
//   });
//   if (!res.ok) throw new Error(`Agenda Clínica respondió ${res.status}`);
//   const data = await res.json();
//   // Forma esperada (ver control-Front/.../mocks/agendaClinicaMockData.js):
//   // { reservas, confirmaciones, fichasClinicas, ultimoIngreso, frecuenciaIngreso }
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
};
