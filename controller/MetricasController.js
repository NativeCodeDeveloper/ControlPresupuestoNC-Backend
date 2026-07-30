import * as Metricas from '../model/MetricasNegocio.js';

function getPeriodo(req) {
    const now = new Date();
    const anio = Number(req.query.anio) || now.getFullYear();
    const mes = Number(req.query.mes) || (now.getMonth() + 1); // 1-indexed

    const mesStr = String(mes).padStart(2, '0');
    const startDate = `${anio}-${mesStr}-01`;
    const endDate = new Date(anio, mes, 0).toISOString().slice(0, 10); // último día del mes

    return { mes, anio, startDate, endDate };
}

export default class MetricasController {

    static async resumen(req, res) {
        try {
            const { mes, anio, startDate, endDate } = getPeriodo(req);

            const [mrrArpa, churn, churnPeriodo, cac, asp, tendencia] = await Promise.all([
                Metricas.getMRRyARPA(),
                Metricas.getChurnSnapshot(),
                Metricas.getChurnPeriodo(startDate, endDate),
                Metricas.getCAC(startDate, endDate),
                Metricas.getASP(startDate, endDate),
                Metricas.getTendenciaMensual(12),
            ]);

            const ltv = churn.churnRate > 0 ? mrrArpa.arpa / churn.churnRate : null;

            return res.json({
                periodo: { mes, anio, startDate, endDate },
                mrr: mrrArpa.mrr,
                arpa: mrrArpa.arpa,
                cuentasActivas: mrrArpa.cuentasActivas,
                churnRate: churn.churnRate,
                churnCancelados: churn.cancelados,
                churnTotal: churn.total,
                churnRatePeriodo: churnPeriodo.churnRate,
                churnCanceladosPeriodo: churnPeriodo.cancelados,
                churnBasePeriodo: churnPeriodo.base,
                ltv,
                cac: cac.cac,
                cacGastoMarketing: cac.gastoMarketing,
                cacClientesNuevos: cac.clientesNuevos,
                asp: asp.asp,
                aspClientesConsiderados: asp.clientesConsiderados,
                tendencia,
            });
        } catch (e) {
            console.error('[Metricas.resumen]', e.message);
            return res.status(500).json({ message: 'Error al calcular métricas de negocio' });
        }
    }
}
