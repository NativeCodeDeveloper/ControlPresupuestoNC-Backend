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
 * Obtiene todos los clientes activos con sus proyectos
 */
async function getActiveClients() {
  try {
    const rows = await db().ejecutarQuery(`
      SELECT
        nombre_cliente,
        COUNT(*) AS total_proyectos,
        SUM(monto_acordado) AS monto_total,
        MAX(fecha_creacion) AS ultimo_proyecto
      FROM proyectos
      WHERE ${CLIENTE_ACTIVO_FILTER}
      GROUP BY nombre_cliente
      ORDER BY nombre_cliente
    `, []);

    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('[healthScoreService.getActiveClients]', error);
    return [];
  }
}

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
      INNER JOIN proyectos p ON s.id_proyecto = p.id
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
 * Obtiene métricas financieras de un cliente
 * (estado de pagos, morosidad, DTEs, etc.)
 */
async function getClientFinanceMetrics(nombreCliente) {
  try {
    // TODO: Implementar lógica real de pagos/morosidad
    // Por ahora retornamos valores mock

    return {
      estadoPagos: 'verde',
      morosidad: 0,
      dtesAlDia: true,
      montoFacturado: 0,
    };
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

    // Activos
    const clients = await getActiveClients();

    // TODO: Llamar a Agenda Clínica para obtener métricas de uso
    // Por ahora retornamos estructura parcial

    return clients.map(c => ({
      clientId: c.nombre_cliente,
      companyName: c.nombre_cliente,
      score: null, // Se calculará cuando Agenda Clínica esté conectada
      status: 'unknown',
      metrics: {},
      calculatedAt: new Date(),
    }));
  } catch (error) {
    console.error('[healthScoreService.getAllScores]', error);
    throw error;
  }
}

/**
 * Obtiene Health Score de un cliente específico.
 * Cuando Agenda Clínica esté conectada, esto obtendrá métricas reales.
 */
export async function getScore(clientId) {
  try {
    // Obtener configuración del cliente (URL + API key)
    const config = await getClientConfig(clientId);

    // TODO: Cuando Agenda Clínica esté lista:
    // - Usar config.ruta_backend y config.api_key para llamar a la API
    // - Calcular score real con las métricas obtenidas
    // - Guardar historial

    return {
      clientId,
      companyName: clientId,
      score: null, // Se calculará con datos reales
      status: 'unknown',
      metrics: {},
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
    const activos = await getActiveClients();
    const cancelados = await getCancelledClients();

    // TODO: Calcular stats reales basado en scores
    return {
      total: activos.length,
      healthy: 0,
      warning: 0,
      critical: 0,
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
