"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function createPool() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('mysql://')) {
        const url = new URL(dbUrl);
        return promise_1.default.createPool({
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            waitForConnections: true,
            connectionLimit: 10,
            timezone: '+00:00',
        });
    }
    return promise_1.default.createPool({
        host: process.env.DB_HOST || 'web214.dogado.net',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        timezone: '+00:00',
    });
}
const pool = createPool();
const query = async (text, params) => {
    const [result] = await pool.query(text, params);
    if (Array.isArray(result)) {
        return { rows: result, rowCount: result.length };
    }
    const header = result;
    return { rows: [], rowCount: header.affectedRows };
};
exports.query = query;
exports.default = pool;
