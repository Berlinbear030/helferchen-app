import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function createPool(): mysql.Pool {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.startsWith('mysql://')) {
    const url = new URL(dbUrl);
    return mysql.createPool({
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
  return mysql.createPool({
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

export const query = async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
  const [result] = await pool.query(text, params);
  if (Array.isArray(result)) {
    return { rows: result as any[], rowCount: (result as any[]).length };
  }
  const header = result as mysql.ResultSetHeader;
  return { rows: [], rowCount: header.affectedRows };
};

export default pool;
