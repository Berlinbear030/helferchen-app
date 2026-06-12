import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export let dbConnected = false;

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

function createPool(): mysql.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  if (!dbUrl.startsWith('mysql://')) return null;

  const url = new URL(dbUrl);
  return mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    waitForConnections: true,
    connectionLimit: 5,       // keep low for shared hosting
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
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

export function startKeepalive(): void {
  if (keepaliveTimer || !pool) return;
  keepaliveTimer = setInterval(async () => {
    if (!dbConnected) return;
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
    } catch {
      dbConnected = false;
      console.warn('[DB] Keepalive ping failed — reconnecting…');
      await testConnection();
    }
  }, 30_000);
  // Don't let this interval block process exit
  if (keepaliveTimer.unref) keepaliveTimer.unref();
}

// ── Raw query helper with auto-reconnect ───────────────────────────────────────
async function execQuery(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
  const [result] = await pool!.query(text, params);
  if (Array.isArray(result)) {
    return { rows: result as any[], rowCount: (result as any[]).length };
  }
  const header = result as mysql.ResultSetHeader;
  return { rows: [], rowCount: header.affectedRows };
}

export const query = async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
  if (!pool || !dbConnected) {
    throw new Error('Database not available');
  }
  try {
    return await execQuery(text, params);
  } catch (err: any) {
    if (RECONNECT_CODES.has(err.code)) {
      dbConnected = false;
      console.error(`[DB] Connection error (${err.code}), reconnecting…`);
      // Wait briefly and retry once
      await new Promise(r => setTimeout(r, 500));
      const ok = await testConnection();
      if (!ok) throw new Error('Database not available after reconnect');
      return await execQuery(text, params);
    }
    throw err;
  }
};

// ── Connection test ────────────────────────────────────────────────────────────
export async function testConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dbConnected = true;
    return true;
  } catch {
    dbConnected = false;
    return false;
  }
}

export default pool;
