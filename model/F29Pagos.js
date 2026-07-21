import DataBase from '../config/Database.js';
import { calcularF29 } from '../services/financeService.js';

const db = () => DataBase.getInstance();

// ─── Historial ────────────────────────────────────────────────────────────────
// Últimos N períodos: si el período ya fue marcado como pagado, devuelve el
// snapshot guardado; si no, calcula F29 en vivo para ese período (pendiente).
export async function getHistorial(mesesAtras = 12) {
    const now = new Date();
    const periodos = [];
    for (let i = 0; i < mesesAtras; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periodos.push({ mes: d.getMonth() + 1, anio: d.getFullYear() });
    }

    const placeholders = periodos.map(() => '(?,?)').join(',');
    const rows = await db().ejecutarQuery(
        `SELECT * FROM f29_pagos WHERE (anio, mes) IN (${placeholders})`,
        periodos.flatMap((p) => [p.anio, p.mes])
    );
    const rowsMap = new Map((rows ?? []).map((r) => [`${r.anio}-${r.mes}`, r]));

    const resultado = [];
    for (const p of periodos) {
        const saved = rowsMap.get(`${p.anio}-${p.mes}`);
        if (saved) {
            resultado.push({
                mes: saved.mes,
                anio: saved.anio,
                iva_neto: Number(saved.iva_neto),
                total_f29: Number(saved.total_f29),
                debito_fiscal: Number(saved.debito_fiscal),
                credito_fiscal: Number(saved.credito_fiscal),
                fecha_vencimiento: saved.fecha_vencimiento,
                pagado: !!saved.pagado,
                fecha_pago: saved.fecha_pago,
                notas: saved.notas,
                calculado: false
            });
        } else {
            const calc = await calcularF29({ mes: p.mes, year: p.anio });
            resultado.push({
                mes: p.mes,
                anio: p.anio,
                iva_neto: calc.iva_neto,
                total_f29: calc.total_f29,
                debito_fiscal: calc.debito_fiscal.iva,
                credito_fiscal: calc.credito_fiscal.total,
                fecha_vencimiento: calc.vencimiento,
                pagado: false,
                fecha_pago: null,
                notas: null,
                calculado: true
            });
        }
    }
    return resultado;
}

// ─── Marcar como pagado ─────────────────────────────────────────────────────
// Toma un snapshot del cálculo F29 actual para el período y lo guarda como pagado.
export async function marcarPagado({ mes, anio, fecha_pago, notas }) {
    const calc = await calcularF29({ mes, year: anio });
    const fechaPagoFinal = fecha_pago || new Date().toISOString().slice(0, 10);

    await db().ejecutarQuery(
        `INSERT INTO f29_pagos (mes, anio, iva_neto, total_f29, debito_fiscal, credito_fiscal, fecha_vencimiento, pagado, fecha_pago, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
            iva_neto = VALUES(iva_neto),
            total_f29 = VALUES(total_f29),
            debito_fiscal = VALUES(debito_fiscal),
            credito_fiscal = VALUES(credito_fiscal),
            fecha_vencimiento = VALUES(fecha_vencimiento),
            pagado = 1,
            fecha_pago = VALUES(fecha_pago),
            notas = VALUES(notas)`,
        [mes, anio, calc.iva_neto, calc.total_f29, calc.debito_fiscal.iva, calc.credito_fiscal.total, calc.vencimiento, fechaPagoFinal, notas ?? null]
    );

    return { mes, anio, iva_neto: calc.iva_neto, total_f29: calc.total_f29, fecha_pago: fechaPagoFinal, pagado: true };
}

// ─── Desmarcar (por error) ──────────────────────────────────────────────────
export async function desmarcarPagado(mes, anio) {
    return db().ejecutarQuery(
        `DELETE FROM f29_pagos WHERE mes = ? AND anio = ?`,
        [mes, anio]
    );
}
