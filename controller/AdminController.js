import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import DataBase from '../config/Database.js';

const execAsync = promisify(exec);
const db = () => DataBase.getInstance();

// Cache de la última lectura de /proc/stat para calcular delta entre requests
// (evita medir la CPU del propio handler, que inflaría el resultado)
let lastCpuStat = null;
let lastCpuTime = 0;

function readProcStat() {
    try {
        return fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number);
    } catch { return null; }
}

function cpuPercent() {
    const now = Date.now();
    const cur = readProcStat();
    if (!cur) return null;

    let pct = null;
    if (lastCpuStat && (now - lastCpuTime) > 1000) {
        const idle  = v => v[3] + v[4]; // idle + iowait
        const total = v => v.reduce((s, x) => s + x, 0);
        const dIdle  = idle(cur)  - idle(lastCpuStat);
        const dTotal = total(cur) - total(lastCpuStat);
        if (dTotal > 0) pct = Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
    }

    lastCpuStat = cur;
    lastCpuTime = now;
    return pct; // null en la primera llamada (sin baseline aún)
}

async function diskInfo(host, sshPrefix) {
    const cmd = "df -BM / | awk 'NR==2{print $2,$3,$5}'";
    const run  = host ? `${sshPrefix} '${cmd}'` : cmd;
    try {
        const { stdout } = await execAsync(run, { timeout: 8000 });
        const [total, used, pct] = stdout.trim().split(/\s+/);
        return {
            total:   parseInt(total),
            used:    parseInt(used),
            percent: parseInt(pct),
        };
    } catch { return null; }
}

async function pm2Stats(names, sshPrefix) {
    const cmd = 'pm2 jlist 2>/dev/null';
    const run  = sshPrefix ? `${sshPrefix} '${cmd}'` : cmd;
    try {
        const { stdout } = await execAsync(run, { timeout: 8000 });
        const list = JSON.parse(stdout || '[]');
        return names.map(name => {
            const p = list.find(x => x.name === name);
            if (!p) return { name, status: 'unknown' };
            return {
                name,
                status:   p.pm2_env?.status,
                cpu:      p.monit?.cpu,
                memory:   Math.round((p.monit?.memory || 0) / 1024 / 1024),
                restarts: p.pm2_env?.restart_time,
                uptime:   p.pm2_env?.pm_uptime,
            };
        });
    } catch { return names.map(n => ({ name: n, status: 'unknown' })); }
}

export default class AdminController {

    static async listServers(req, res) {
        try {
            const rows = await db().ejecutarQuery(
                'SELECT id, nombre, host, ssh_user, is_local, pm2_processes, log_dir FROM monitor_servers WHERE activo = 1 ORDER BY id'
            );
            res.json(rows);
        } catch (e) {
            console.error('[ADMIN] listServers:', e.message);
            res.status(500).json({ error: 'Error al listar servidores' });
        }
    }

    static async getStats(req, res) {
        try {
            const rows = await db().ejecutarQuery(
                'SELECT * FROM monitor_servers WHERE id = ? AND activo = 1', [req.params.id]
            );
            if (!rows.length) return res.status(404).json({ error: 'Servidor no encontrado' });
            const srv = rows[0];
            // mysql2 puede devolver JSON columns ya parseadas o como string
            const rawProc   = srv.pm2_processes;
            const processes = Array.isArray(rawProc) ? rawProc
                            : (rawProc ? JSON.parse(rawProc) : []);
            const sshPrefix = srv.is_local ? null : `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${srv.ssh_user}@${srv.host}`;

            let cpu, ram, disk, pm2;

            if (srv.is_local) {
                const total = os.totalmem();
                const free  = os.freemem();
                // CPU: síncrono, usa delta entre requests (no bloquea ni se mide a sí mismo)
                cpu = cpuPercent();
                [disk, pm2] = await Promise.all([
                    diskInfo(null, null),
                    pm2Stats(processes, null),
                ]);
                ram = {
                    total:   Math.round(total / 1024 / 1024),
                    used:    Math.round((total - free) / 1024 / 1024),
                    percent: Math.round((1 - free / total) * 100),
                };
            } else {
                const memCmd = `${sshPrefix} "free -m | awk 'NR==2{print \\$2,\\$3}'"`;
                const [diskRes, pm2Res, memOut] = await Promise.all([
                    diskInfo(srv.host, sshPrefix),
                    pm2Stats(processes, sshPrefix),
                    execAsync(memCmd, { timeout: 8000 }).then(r => r.stdout.trim()).catch(() => ''),
                ]);
                disk = diskRes;
                pm2  = pm2Res;
                const [totalM, usedM] = memOut.split(/\s+/).map(Number);
                ram = totalM ? { total: totalM, used: usedM, percent: Math.round(usedM / totalM * 100) } : null;
                cpu = null; // SSH CPU requires two reads with delay — omit for remoto
            }

            res.json({ server: { id: srv.id, nombre: srv.nombre, host: srv.host, is_local: srv.is_local }, cpu, ram, disk, pm2 });
        } catch (e) {
            console.error('[ADMIN] getStats:', e.message);
            res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
    }

    static async getLogs(req, res) {
        try {
            const rows = await db().ejecutarQuery(
                'SELECT * FROM monitor_servers WHERE id = ? AND activo = 1', [req.params.id]
            );
            if (!rows.length) return res.status(404).json({ error: 'Servidor no encontrado' });
            const srv = rows[0];

            const lines    = Math.min(parseInt(req.query.lines) || 150, 500);
            const type     = req.query.type === 'error' ? 'error' : 'out';
            const procName = (req.query.process || 'finance-back').replace(/[^a-zA-Z0-9_-]/g, '');
            const logDir   = srv.log_dir || '/root/.pm2/logs';
            const logFile  = `${logDir}/${procName}-${type}.log`;

            const tailCmd = `tail -n ${lines} "${logFile}" 2>/dev/null || true`;
            const run     = srv.is_local
                ? tailCmd
                : `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${srv.ssh_user}@${srv.host} '${tailCmd}'`;

            const { stdout } = await execAsync(run, { timeout: 10000 });
            const logLines = stdout.split('\n').filter(Boolean);

            res.json({ lines: logLines, process: procName, type, timestamp: new Date().toISOString() });
        } catch (e) {
            console.error('[ADMIN] getLogs:', e.message);
            res.status(500).json({ error: 'Error al leer logs' });
        }
    }

    static async createServer(req, res) {
        try {
            const { nombre, host, ssh_user = 'root', is_local = 0, pm2_processes = [], log_dir = '/root/.pm2/logs' } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
            const r = await db().ejecutarQuery(
                `INSERT INTO monitor_servers (nombre, host, ssh_user, is_local, pm2_processes, log_dir)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [nombre, host || null, ssh_user, is_local ? 1 : 0, JSON.stringify(pm2_processes), log_dir]
            );
            const rows = await db().ejecutarQuery('SELECT * FROM monitor_servers WHERE id = ?', [r.insertId]);
            res.status(201).json(rows[0]);
        } catch (e) {
            console.error('[ADMIN] createServer:', e.message);
            res.status(500).json({ error: 'Error al crear servidor' });
        }
    }

    static async deleteServer(req, res) {
        try {
            await db().ejecutarQuery('UPDATE monitor_servers SET activo = 0 WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'Error al eliminar servidor' });
        }
    }

    static async execCommand(req, res) {
        // Whitelist de comandos permitidos
        const ALLOWED = [
            /^pm2\s+(list|status|jlist)$/,
            /^pm2\s+show\s+[\w-]+$/,
            /^pm2\s+logs\s+[\w-]+\s+--nostream\s+--lines\s+\d+$/,
            /^pm2\s+restart\s+[\w-]+$/,
            /^df\s+-[hBMb]+(\s+\/)?$/,
            /^free\s+-[mhgb]$/,
            /^uptime$/,
            /^top\s+-bn1\s*\|\s*head\s+-\d+$/,
            /^ps\s+aux\s*\|\s*head\s+-\d+$/,
            /^ls\s+(-la?\s+)?\/root\/\.pm2\/logs\/?$/,
            /^tail\s+-n\s+\d{1,3}\s+\/root\/\.pm2\/logs\/[\w-]+-[\w]+\.log$/,
            /^node\s+--version$/,
            /^npm\s+--version$/,
        ];

        try {
            const { command } = req.body;
            if (!command?.trim()) return res.status(400).json({ error: 'Comando vacío' });

            const cmd = command.trim();
            const allowed = ALLOWED.some(rx => rx.test(cmd));
            if (!allowed) {
                return res.status(403).json({ error: `Comando no permitido: "${cmd}"` });
            }

            const rows = await db().ejecutarQuery(
                'SELECT * FROM monitor_servers WHERE id = ? AND activo = 1', [req.params.id]
            );
            if (!rows.length) return res.status(404).json({ error: 'Servidor no encontrado' });
            const srv = rows[0];

            const run = srv.is_local ? cmd
                : `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${srv.ssh_user}@${srv.host} '${cmd}'`;

            const { stdout, stderr } = await execAsync(run, { timeout: 15000 });
            res.json({ output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''), command: cmd });
        } catch (e) {
            const msg = e.killed ? 'Timeout (15s)' : e.stderr || e.message;
            res.json({ output: `Error: ${msg}`, command: req.body?.command });
        }
    }
}
