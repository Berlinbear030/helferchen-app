"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.dbConnected = void 0;
exports.testConnection = testConnection;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Set to true once DB connection is verified at startup
exports.dbConnected = false;
function createPool() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl)
        return null;
    if (dbUrl.startsWith('mysql://')) {
        const url = new URL(dbUrl);
        return promise_1.default.createPool({
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 30000,
            timezone: '+00:00',
            connectTimeout: 10000,
        });
    }
    return null;
}
const pool = createPool();
const query = async (text, params) => {
    if (!pool || !exports.dbConnected) {
        throw new Error('Database not available');
    }
    try {
        const [result] = await pool.query(text, params);
        if (Array.isArray(result)) {
            return { rows: result, rowCount: result.length };
        }
        const header = result;
        return { rows: [], rowCount: header.affectedRows };
    }
    catch (err) {
        // On fatal connection errors, mark as disconnected and re-probe
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
            exports.dbConnected = false;
            console.error('DB connection lost, attempting reconnect…');
            const ok = await testConnection();
            if (!ok)
                throw new Error('Database not available');
            const [result] = await pool.query(text, params);
            if (Array.isArray(result))
                return { rows: result, rowCount: result.length };
            const header = result;
            return { rows: [], rowCount: header.affectedRows };
        }
        throw err;
    }
};
exports.query = query;
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
