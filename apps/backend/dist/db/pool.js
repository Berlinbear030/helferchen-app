"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.dbConnected = void 0;
exports.startKeepalive = startKeepalive;
exports.testConnection = testConnection;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.dbConnected = false;
// Error codes that indicate a broken/stale connection (not a query logic error)
const RECONNECT_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'PROTOCOL_SEQUENCE_TIMEOUT',
    'ER_CON_COUNT_ERROR',
]);
function createPool() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl)
        return null;
    if (!dbUrl.startsWith('mysql://'))
        return null;
    const url = new URL(dbUrl);
    return promise_1.default.createPool({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        waitForConnections: true,
        connectionLimit: 5, // keep low for shared hosting
        queueLimit: 50,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        timezone: '+00:00',
        connectTimeout: 15000,
    });
}
const pool = createPool();
// ── Heartbeat keepalive ────────────────────────────────────────────────────────
// Shared-hosting MySQL kills idle connections after wait_timeout (often 60s).
// We ping every 30 s to keep at least one connection alive in the pool.
let keepaliveTimer = null;
function startKeepalive() {
    if (keepaliveTimer || !pool)
        return;
    keepaliveTimer = setInterval(async () => {
        if (!exports.dbConnected)
            return;
        try {
            const conn = await pool.getConnection();
            await conn.ping();
            conn.release();
        }
        catch {
            exports.dbConnected = false;
            console.warn('[DB] Keepalive ping failed — reconnecting…');
            await testConnection();
        }
    }, 30000);
    // Don't let this interval block process exit
    if (keepaliveTimer.unref)
        keepaliveTimer.unref();
}
// ── Raw query helper with auto-reconnect ───────────────────────────────────────
async function execQuery(text, params) {
    const [result] = await pool.query(text, params);
    if (Array.isArray(result)) {
        return { rows: result, rowCount: result.length };
    }
    const header = result;
    return { rows: [], rowCount: header.affectedRows };
}
const query = async (text, params) => {
    if (!pool || !exports.dbConnected) {
        throw new Error('Database not available');
    }
    try {
        return await execQuery(text, params);
    }
    catch (err) {
        if (RECONNECT_CODES.has(err.code)) {
            exports.dbConnected = false;
            console.error(`[DB] Connection error (${err.code}), reconnecting…`);
            // Wait briefly and retry once
            await new Promise(r => setTimeout(r, 500));
            const ok = await testConnection();
            if (!ok)
                throw new Error('Database not available after reconnect');
            return await execQuery(text, params);
        }
        throw err;
    }
};
exports.query = query;
// ── Connection test ────────────────────────────────────────────────────────────
async function testConnection() {
    if (!pool)
        return false;
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        exports.dbConnected = true;
        return true;
    }
    catch {
        exports.dbConnected = false;
        return false;
    }
}
exports.default = pool;
