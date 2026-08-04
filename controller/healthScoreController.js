/**
 * healthScoreController.js
 *
 * Controlador para Health Score de clientes.
 *
 * TODO: Cuando Agenda Clínica esté conectada:
 * - Estos endpoints consumirán la API de Agenda Clínica
 * - Implementar caché Redis para no saturar a Agenda Clínica
 * - Agregar autenticación entre servidores
 */

import healthScoreService from '../services/healthScoreService.js';

/**
 * GET /api/health-score/companies
 * Obtiene Health Score de todos los clientes activos
 *
 * TODO: Implementar paginación
 */
export const getAllHealthScores = async (req, res) => {
  try {
    const { filter } = req.query; // 'activos' | 'cancelados'

    const scores = await healthScoreService.getAllScores(filter);
    res.json(scores);
  } catch (error) {
    console.error('[healthScoreController.getAllHealthScores]', error);
    res.status(500).json({ error: 'Error al obtener Health Scores' });
  }
};

/**
 * GET /api/health-score/companies/:clientId
 * Obtiene Health Score de un cliente específico
 */
export const getHealthScore = async (req, res) => {
  try {
    const { clientId } = req.params;
    const score = await healthScoreService.getScore(clientId);
    res.json(score);
  } catch (error) {
    console.error('[healthScoreController.getHealthScore]', error);
    res.status(500).json({ error: 'Error al obtener Health Score' });
  }
};

/**
 * GET /api/health-score/companies/:clientId/history
 * Obtiene historial de Health Score
 *
 * TODO: Implementar cuando exista tabla de historial
 */
export const getHealthScoreHistory = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { months = 6 } = req.query;
    const history = await healthScoreService.getHistory(clientId, parseInt(months));
    res.json(history);
  } catch (error) {
    console.error('[healthScoreController.getHealthScoreHistory]', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

/**
 * GET /api/health-score/stats
 * Obtiene estadísticas agregadas (healthy, warning, critical counts)
 */
export const getHealthScoreStats = async (req, res) => {
  try {
    const stats = await healthScoreService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[healthScoreController.getHealthScoreStats]', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};
