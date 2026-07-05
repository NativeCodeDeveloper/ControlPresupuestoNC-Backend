import DataBase from '../config/Database.js';
import { encrypt, decrypt } from '../services/encryptionService.js';

const db = () => DataBase.getInstance();

// Campos cifrados en boveda_entradas
const ENCRYPTED_ENTRY = ['ssh_clave', 'cpanel_clave', 'ftp_clave', 'db_clave'];
// Campos cifrados en env_vars
const ENCRYPTED_ENV   = ['valor'];
// Campos cifrados en accesos
const ENCRYPTED_ACC   = ['clave'];

function encryptFields(obj, fields) {
    const out = { ...obj };
    for (const f of fields) {
        if (f in out && out[f] !== undefined) out[f] = encrypt(out[f]);
    }
    return out;
}

function decryptFields(obj, fields) {
    if (!obj) return obj;
    const out = { ...obj };
    for (const f of fields) {
        if (f in out && out[f]) out[f] = decrypt(out[f]);
    }
    return out;
}

// ── Entradas ──────────────────────────────────────────────────────────────────

export async function getEntradas() {
    return db().ejecutarQuery(`
        SELECT be.*,
               p.nombre        AS proyecto_nombre,
               p.nombre_cliente,
               p.codigo_interno
        FROM boveda_entradas be
        JOIN proyectos p ON be.id_proyecto = p.id_proyecto
        ORDER BY p.nombre_cliente ASC, p.nombre ASC
    `, []);
    // No desciframos en listado — los secretos solo en getEntrada individual
}

export async function getEntrada(id) {
    const rows = await db().ejecutarQuery(`
        SELECT be.*,
               p.nombre          AS proyecto_nombre,
               p.nombre_cliente,
               p.codigo_interno,
               p.email_cliente,
               p.telefono_cliente,
               srv.ruta_backend  AS srv_ruta_backend,
               srv.version       AS srv_version,
               srv.estado        AS srv_estado
        FROM boveda_entradas be
        JOIN proyectos p ON be.id_proyecto = p.id_proyecto
        LEFT JOIN synapse_servidores srv
            ON srv.id_servidor = (
                SELECT id_servidor FROM synapse_servidores
                WHERE id_proyecto = be.id_proyecto AND activo = 1
                ORDER BY id_servidor DESC LIMIT 1
            )
        WHERE be.id_entrada = ?
    `, [id]);
    return decryptFields(rows?.[0] ?? null, ENCRYPTED_ENTRY);
}

export async function getEntradaByProyecto(id_proyecto) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM boveda_entradas WHERE id_proyecto = ?`, [id_proyecto]
    );
    return decryptFields(rows?.[0] ?? null, ENCRYPTED_ENTRY);
}

export async function createEntrada(data) {
    const enc = encryptFields(data, ENCRYPTED_ENTRY);
    const campos = [
        'id_proyecto','hostname','ssh_usuario','ssh_clave','ssh_puerto',
        'cpanel_url','cpanel_usuario','cpanel_clave',
        'repo_url','repo_rama_main','repo_rama_deploy',
        'dominio_prod','dominio_staging','proveedor_dns',
        'version_actual','fecha_deploy','proceso_pm2','ruta_backend','ruta_frontend',
        'ftp_host','ftp_usuario','ftp_clave',
        'db_host','db_nombre','db_usuario','db_clave',
        'notas_emergencia',
    ];
    const cols = campos.filter(c => enc[c] !== undefined);
    const vals = cols.map(c => enc[c] ?? null);
    const result = await db().ejecutarQuery(
        `INSERT INTO boveda_entradas (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        vals
    );
    return result.insertId;
}

export async function updateEntrada(id, data) {
    const enc = encryptFields(data, ENCRYPTED_ENTRY);
    const permitidos = [
        'hostname','ssh_usuario','ssh_clave','ssh_puerto',
        'cpanel_url','cpanel_usuario','cpanel_clave',
        'repo_url','repo_rama_main','repo_rama_deploy',
        'dominio_prod','dominio_staging','proveedor_dns',
        'version_actual','fecha_deploy','proceso_pm2','ruta_backend','ruta_frontend',
        'ftp_host','ftp_usuario','ftp_clave',
        'db_host','db_nombre','db_usuario','db_clave',
        'notas_emergencia',
    ];
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(enc)) {
        if (permitidos.includes(k)) { sets.push(`${k} = ?`); vals.push(v ?? null); }
    }
    if (!sets.length) return;
    vals.push(id);
    return db().ejecutarQuery(`UPDATE boveda_entradas SET ${sets.join(', ')} WHERE id_entrada = ?`, vals);
}

// ── Env Vars ──────────────────────────────────────────────────────────────────

export async function getEnvVars(id_entrada) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM boveda_env_vars WHERE id_entrada = ? ORDER BY entorno, clave ASC`,
        [id_entrada]
    );
    return (rows || []).map(r => decryptFields(r, ENCRYPTED_ENV));
}

export async function createEnvVar(id_entrada, { entorno, clave, valor, descripcion }) {
    const enc = encrypt(valor);
    const result = await db().ejecutarQuery(
        `INSERT INTO boveda_env_vars (id_entrada, entorno, clave, valor, descripcion) VALUES (?,?,?,?,?)`,
        [id_entrada, entorno || 'produccion', clave, enc, descripcion ?? null]
    );
    return result.insertId;
}

export async function updateEnvVar(id_env, { entorno, clave, valor, descripcion }) {
    const enc = valor !== undefined ? encrypt(valor) : undefined;
    const sets = [], vals = [];
    if (entorno    !== undefined) { sets.push('entorno = ?');    vals.push(entorno); }
    if (clave      !== undefined) { sets.push('clave = ?');      vals.push(clave); }
    if (enc        !== undefined) { sets.push('valor = ?');      vals.push(enc); }
    if (descripcion !== undefined){ sets.push('descripcion = ?');vals.push(descripcion ?? null); }
    if (!sets.length) return;
    vals.push(id_env);
    return db().ejecutarQuery(`UPDATE boveda_env_vars SET ${sets.join(', ')} WHERE id_env = ?`, vals);
}

export async function deleteEnvVar(id_env) {
    return db().ejecutarQuery(`DELETE FROM boveda_env_vars WHERE id_env = ?`, [id_env]);
}

// ── Accesos ───────────────────────────────────────────────────────────────────

export async function getAccesos(id_entrada) {
    const rows = await db().ejecutarQuery(
        `SELECT * FROM boveda_accesos WHERE id_entrada = ? ORDER BY tipo, nombre ASC`,
        [id_entrada]
    );
    return (rows || []).map(r => decryptFields(r, ENCRYPTED_ACC));
}

export async function createAcceso(id_entrada, { tipo, nombre, usuario, clave, url, notas }) {
    const enc = encrypt(clave);
    const result = await db().ejecutarQuery(
        `INSERT INTO boveda_accesos (id_entrada, tipo, nombre, usuario, clave, url, notas) VALUES (?,?,?,?,?,?,?)`,
        [id_entrada, tipo || 'api_key', nombre, usuario ?? null, enc, url ?? null, notas ?? null]
    );
    return result.insertId;
}

export async function updateAcceso(id_acceso, { tipo, nombre, usuario, clave, url, notas }) {
    const sets = [], vals = [];
    if (tipo    !== undefined) { sets.push('tipo = ?');    vals.push(tipo); }
    if (nombre  !== undefined) { sets.push('nombre = ?');  vals.push(nombre); }
    if (usuario !== undefined) { sets.push('usuario = ?'); vals.push(usuario ?? null); }
    if (clave   !== undefined) { sets.push('clave = ?');   vals.push(encrypt(clave)); }
    if (url     !== undefined) { sets.push('url = ?');     vals.push(url ?? null); }
    if (notas   !== undefined) { sets.push('notas = ?');   vals.push(notas ?? null); }
    if (!sets.length) return;
    vals.push(id_acceso);
    return db().ejecutarQuery(`UPDATE boveda_accesos SET ${sets.join(', ')} WHERE id_acceso = ?`, vals);
}

export async function deleteAcceso(id_acceso) {
    return db().ejecutarQuery(`DELETE FROM boveda_accesos WHERE id_acceso = ?`, [id_acceso]);
}
