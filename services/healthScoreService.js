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
async function _getProyectosFinancieros(nombreCliente = null) {
  const params = [];
  let where = CLIENTE_ACTIVO_FILTER;
  if (nombreCliente) {
    where += ` AND nombre_cliente = ?`;
    params.push(nombreCliente);
  }

  const rows = await db().ejecutarQuery(`
    SELECT id_proyecto, nombre_cliente, monto_acordado, ciclo_facturacion, fecha_proximo_pago
    FROM proyectos
    WHERE ${where}
  `, params);

  return Array.isArray(rows) ? rows : [];
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
  const montoFacturado = proyectosCliente.reduce((sum, p) => sum + Number(p.monto_acordado || 0), 0);

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
// Mientras Agenda Clínica no esté conectada, el status se calcula SOLO con
// comportamiento de pago (estadoPagos + morosidad + dtesAlDia): esto SÍ es
// un status real y accionable para priorizar (cliente atrasado en pago o
// con DTE rechazado sale crítico/en riesgo de verdad), no un placeholder.
//
// valorFacturado se muestra igual como métrica informativa (bloque VALOR),
// pero NO entra al score: su normalización asume $5M como "excelente", una
// escala pensada para cuando USO (60% del modelo completo) también aporta.
// Con subscripciones típicas de ~$10-50k, esa escala deja normalizedValue
// cerca de 0 SIEMPRE — si pesara en el score, ningún cliente llegaría nunca
// a "healthy" sin importar qué tan bien pague, que es justo lo que no
// queremos (el pedido explícito fue "status real basado en pagos").
//
// Pesos proporcionales a los de control-Front/.../healthScoreConstants.js
// (PAGA: estadoPagos 10 : morosidad 5 : dtesAlDia 5 → razón 2:1:1,
// reescalados a 100). DISPLAY_WEIGHTS son los pesos originales (incluye
// valorFacturado 20) solo para mostrar en las barras de la UI — no se usan
// para calcular el score. Cuando se conecte Agenda Clínica, reemplazar este
// bloque por el cálculo completo (USO+VALOR+PAGA) con los pesos originales
// sin reescalar — ver _fetchAgendaClinicaMetrics más abajo, ya dejado listo
// para activar.
const SCORE_WEIGHTS = { estadoPagos: 50, morosidad: 25, dtesAlDia: 25 };
const DISPLAY_WEIGHTS = { valorFacturado: 20, estadoPagos: 10, morosidad: 5, dtesAlDia: 5 };
const SCORE_THRESHOLDS = { HEALTHY: 70, WARNING: 40 };

function _normalizeValorFacturado(monto) {
  const max = 5000000; // $5M = 100 (misma escala que el frontend)
  return Math.round(Math.min(100, (Math.sqrt(monto) / Math.sqrt(max)) * 100));
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

function _buildFinanceScore(finance) {
  const normalized = {
    valorFacturado: _normalizeValorFacturado(finance.montoFacturado || 0),
    estadoPagos: _normalizeEstadoPagos(finance.estadoPagos),
    morosidad: _normalizeMorosidad(finance.morosidad || 0),
    dtesAlDia: _normalizeDtesAlDia(finance.dtesAlDia),
  };

  let score = 0;
  for (const [key, value] of Object.entries(SCORE_WEIGHTS)) {
    score += (normalized[key] * value) / 100;
  }
  score = Math.round(score);

  let status = 'critical';
  if (score >= SCORE_THRESHOLDS.HEALTHY) status = 'healthy';
  else if (score >= SCORE_THRESHOLDS.WARNING) status = 'warning';

  // Contribución mostrada en la UI usa los pesos "de exhibición" (originales),
  // no los pesos de score — así valorFacturado se ve consistente con el resto
  // de las barras aunque no pondere en el status.
  const contribution = (key) => Math.round((normalized[key] * DISPLAY_WEIGHTS[key]) / 100);

  const metrics = {
    valorFacturado: {
      id: 'valorFacturado', label: 'Valor facturado', category: 'valor',
      value: finance.montoFacturado || 0, weight: DISPLAY_WEIGHTS.valorFacturado,
      maxPossible: 5000000, normalizedValue: normalized.valorFacturado,
      contribution: contribution('valorFacturado'), unit: '$',
    },
    estadoPagos: {
      id: 'estadoPagos', label: 'Estado de pagos', category: 'paga',
      value: finance.estadoPagos, weight: DISPLAY_WEIGHTS.estadoPagos,
      maxPossible: 1, normalizedValue: normalized.estadoPagos,
      contribution: contribution('estadoPagos'), unit: '',
    },
    morosidad: {
      id: 'morosidad', label: 'Morosidad', category: 'paga',
      value: finance.morosidad || 0, weight: DISPLAY_WEIGHTS.morosidad,
      maxPossible: 90, normalizedValue: normalized.morosidad,
      contribution: contribution('morosidad'), unit: 'días atraso',
    },
    dtesAlDia: {
      id: 'dtesAlDia', label: 'DTEs al día', category: 'paga',
      value: finance.dtesAlDia, weight: DISPLAY_WEIGHTS.dtesAlDia,
      maxPossible: 1, normalizedValue: normalized.dtesAlDia,
      contribution: contribution('dtesAlDia'), unit: '',
    },
  };

  return { score, status, metrics: { ..._buildUsoPlaceholderMetrics(), ...metrics } };
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

    const dteRechazadoIds = await _getProyectosConDteRechazado(proyectos.map(p => p.id_proyecto));

    return Array.from(porCliente.entries()).map(([nombreCliente, proyectosCliente]) => {
      const finance = _aggregateFinanceMetrics(proyectosCliente, dteRechazadoIds);
      const { score, status, metrics } = _buildFinanceScore(finance);

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

    const finance = await getClientFinanceMetrics(clientId);
    const { score, status, metrics } = _buildFinanceScore(finance);

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
