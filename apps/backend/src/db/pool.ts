import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Set to true once DB connection is verified at startup
export let dbConnected = false;

function createPool(): mysql.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  if (dbUrl.startsWith('mysql://')) {
    const url = new URL(dbUrl);
    return mysql.createPool({
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

export const query = async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
  if (!pool || !dbConnected) {
    throw new Error('Database not available');
  }
  try {
    const [result] = await pool.query(text, params);
    if (Array.isArray(result)) {
      return { rows: result as any[], rowCount: (result as any[]).length };
    }
    const header = result as mysql.ResultSetHeader;
    return { rows: [], rowCount: header.affectedRows };
  } catch (err: any) {
    // On fatal connection errors, mark as disconnected and re-probe
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
      dbConnected = false;
      console.error('DB connection lost, attempting reconnect…');
      const ok = await testConnection();
      if (!ok) throw new Error('Database not available');
      const [result] = await pool.query(text, params);
      if (Array.isArray(result)) return { rows: result as any[], rowCount: (result as any[]).length };
      const header = result as mysql.ResultSetHeader;
      return { rows: [], rowCount: header.affectedRows };
    }
    throw err;
  }
};

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
