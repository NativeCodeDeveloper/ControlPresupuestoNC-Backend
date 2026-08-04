/**
 * healthScoreRoutes.js
 *
 * Rutas para Health Score de clientes.
 *
 * TODO: Cuando Agenda Clínica esté conectada:
 * - Estos endpoints consumirán datos reales
 * - Implementar caché Redis
 */

import { Router } from 'express';
import {
  getAllHealthScores,
  getHealthScore,
  getHealthScoreHistory,
  getHealthScoreStats,
  getPortfolioHistory,
} from '../controller/healthScoreController.js';

const router = Router();

// ── Health Score ────────────────────────────────────────────────────────────────

/**
 * GET /api/health-score/companies
 * Obtiene Health Score de todos los clientes
 * Query params:
 * - filter: 'activos' | 'cancelados' (default: 'activos')
 */
router.get('/companies', getAllHealthScores);

/**
 * GET /api/health-score/companies/:clientId
 * Obtiene Health Score de un cliente específico
 */
router.get('/companies/:clientId', getHealthScore);

/**
 * GET /api/health-score/companies/:clientId/history
 * Obtiene historial de Health Score
 * Query params:
 * - months: número de meses (default: 6)
 * TODO: Implementar cuando exista tabla de historial
 */
router.get('/companies/:clientId/history', getHealthScoreHistory);

/**
 * GET /api/health-score/stats
 * Obtiene estadísticas agregadas
 */
router.get('/stats', getHealthScoreStats);

/**
 * GET /api/health-score/historial
 * Tendencia de la distribución de cartera (un snapshot por día)
 * Query params:
 * - days: cuántos días hacia atrás (default 90)
 */
router.get('/historial', getPortfolioHistory);

export default router;
