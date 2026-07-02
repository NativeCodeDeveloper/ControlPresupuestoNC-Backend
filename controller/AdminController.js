import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import DataBase from '../config/Database.js';

const execAsync = promisify(exec);
const db = () => DataBase.getInstance();

// Lee uso de CPU leyendo /proc/stat dos veces con 200ms de diferencia
async function cpuPercent() {
    const read = () => {
        try {
            return fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number);
        } catch { return null; }
    };
    const a = read();
    if (!a) return null;
    await new Promise(r => setTimeout(r, 200));
    const b = read();
    const idle  = v => v[3] + v[4];
    const total = v => v.reduce((s, x) => s + x, 0);
    const usage = 100 - ((idle(b) - idle(a)) / (total(b) - total(a))) * 100;
    return Math.max(0, Math.min(100, Math.round(usage)));
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
            const processes = srv.pm2_processes ? JSON.parse(srv.pm2_processes) : [];
            const sshPrefix = srv.is_local ? null : `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${srv.ssh_user}@${srv.host}`;

            let cpu, ram, disk, pm2;

            if (srv.is_local) {
                const total = os.totalmem();
                const free  = os.freemem();
                [cpu, disk, pm2] = await Promise.all([
                    cpuPercent(),
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
}
