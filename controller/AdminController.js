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

// Devuelve TODOS los procesos PM2 de un servidor (sin filtrar por nombre)
async function pm2AllStats(sshPrefix) {
    const cmd = 'pm2 jlist 2>/dev/null';
    const run  = sshPrefix ? `${sshPrefix} '${cmd}'` : cmd;
    try {
        const { stdout } = await execAsync(run, { timeout: 8000 });
        const list = JSON.parse(stdout || '[]');
        return list.map(p => ({
            name:     p.name,
            status:   p.pm2_env?.status,
            cpu:      p.monit?.cpu,
            memory:   Math.round((p.monit?.memory || 0) / 1024 / 1024),
            restarts: p.pm2_env?.restart_time,
            uptime:   p.pm2_env?.pm_uptime,
        }));
    } catch { return []; }
}

// Construye el prefijo SSH con host/user sanitizados para evitar inyección
function buildSshPrefix(srv) {
    if (srv.is_local) return null;
    const host = (srv.host     || '').replace(/[^a-zA-Z0-9._:-]/g, '');
    const user = (srv.ssh_user || 'root').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!host) return null;
    return `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${user}@${host}`;
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
            const sshPrefix = buildSshPrefix(srv);

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

            const sshPfx  = buildSshPrefix(srv);
            const tailCmd = `tail -n ${lines} "${logFile}" 2>/dev/null || true`;
            const run     = sshPfx ? `${sshPfx} '${tailCmd}'` : tailCmd;

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

            const sshPfx2 = buildSshPrefix(srv);
            const run     = sshPfx2 ? `${sshPfx2} '${cmd}'` : cmd;

            const { stdout, stderr } = await execAsync(run, { timeout: 15000 });
            res.json({ output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''), command: cmd });
        } catch (e) {
            const msg = e.killed ? 'Timeout (15s)' : e.stderr || e.message;
            res.json({ output: `Error: ${msg}`, command: req.body?.command });
        }
    }

    // ── Vista por cliente ─────────────────────────────────────────────────────

    static async listClients(req, res) {
        try {
            const rows = await db().ejecutarQuery(`
                SELECT
                    p.id_proyecto, p.codigo_interno,
                    p.nombre AS nombre_proyecto, p.nombre_cliente, p.email_cliente,
                    ss.id_servidor, ss.ruta_backend, ss.estado AS estado_servidor,
                    ss.version, ss.pm2_process, ss.id_monitor_server,
                    ms.nombre AS nombre_vps, ms.is_local,
                    ms.host AS vps_host, ms.ssh_user AS vps_ssh_user
                FROM proyectos p
                INNER JOIN synapse_servidores ss
                    ON ss.id_proyecto = p.id_proyecto AND ss.activo = 1
                LEFT JOIN monitor_servers ms
                    ON ms.id = ss.id_monitor_server AND ms.activo = 1
                WHERE p.activo = 1
                ORDER BY p.nombre_cliente, p.nombre
            `);

            if (!rows.length) return res.json([]);

            // Recopilar servidores únicos referenciados
            const serverMap = {};
            for (const row of rows) {
                if (row.id_monitor_server && !serverMap[row.id_monitor_server]) {
                    serverMap[row.id_monitor_server] = {
                        id: row.id_monitor_server, nombre: row.nombre_vps,
                        is_local: row.is_local, host: row.vps_host, ssh_user: row.vps_ssh_user,
                    };
                }
            }

            // PM2 stats por servidor en paralelo
            const pm2Cache = {};
            await Promise.all(Object.values(serverMap).map(async srv => {
                try {
                    pm2Cache[srv.id] = await pm2AllStats(buildSshPrefix(srv));
                } catch { pm2Cache[srv.id] = []; }
            }));

            const result = rows.map(row => {
                const pm2List = pm2Cache[row.id_monitor_server] || [];
                const procStats = row.pm2_process
                    ? (pm2List.find(p => p.name === row.pm2_process) || { name: row.pm2_process, status: 'unknown' })
                    : null;
                return {
                    id_proyecto: row.id_proyecto, codigo_interno: row.codigo_interno,
                    nombre_proyecto: row.nombre_proyecto, nombre_cliente: row.nombre_cliente,
                    email_cliente: row.email_cliente,
                    id_servidor: row.id_servidor, ruta_backend: row.ruta_backend,
                    estado_servidor: row.estado_servidor, version: row.version,
                    pm2_process: row.pm2_process, id_monitor_server: row.id_monitor_server,
                    nombre_vps: row.nombre_vps, proc_stats: procStats,
                };
            });

            res.json(result);
        } catch (e) {
            console.error('[ADMIN] listClients:', e.message);
            res.status(500).json({ error: 'Error al obtener clientes' });
        }
    }

    // Retorna todos los procesos PM2 de un servidor (para el selector de asignación)
    static async listServerProcesses(req, res) {
        try {
            const rows = await db().ejecutarQuery(
                'SELECT * FROM monitor_servers WHERE id = ? AND activo = 1', [req.params.id]
            );
            if (!rows.length) return res.status(404).json({ error: 'Servidor no encontrado' });
            const sshPrefix = buildSshPrefix(rows[0]);
            const processes = await pm2AllStats(sshPrefix);
            res.json(processes);
        } catch (e) {
            console.error('[ADMIN] listServerProcesses:', e.message);
            res.status(500).json({ error: 'Error al obtener procesos' });
        }
    }

    // Asigna (o desasigna) el proceso PM2 y servidor monitor de un synapse_servidor
    static async updateClientProcess(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (!id) return res.status(400).json({ error: 'ID inválido' });

            const { pm2_process, id_monitor_server } = req.body;

            // Sanitizar: solo alfanumérico + guiones + underscores
            const safeProcess = pm2_process
                ? String(pm2_process).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || null
                : null;

            const safeServer = id_monitor_server ? parseInt(id_monitor_server) : 1;
            if (isNaN(safeServer) || safeServer < 1) {
                return res.status(400).json({ error: 'id_monitor_server inválido' });
            }

            await db().ejecutarQuery(
                'UPDATE synapse_servidores SET pm2_process = ?, id_monitor_server = ? WHERE id_servidor = ? AND activo = 1',
                [safeProcess, safeServer, id]
            );
            res.json({ ok: true });
        } catch (e) {
            console.error('[ADMIN] updateClientProcess:', e.message);
            res.status(500).json({ error: 'Error al actualizar proceso' });
        }
    }
}
