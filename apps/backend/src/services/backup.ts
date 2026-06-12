import * as fs from 'fs/promises';
import * as path from 'path';
import { query, dbConnected } from '../db/pool';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 30;
const BACKUP_HOUR = 20; // 20:00 server time

const TABLES = [
  'users', 'customers', 'assignments', 'booking_requests',
  'time_logs', 'signatures', 'reports', 'audit_logs', 'roles', 'shop_articles',
];

async function performBackup(): Promise<void> {
  if (!dbConnected) {
    console.log('[Backup] DB not connected — skipping');
    return;
  }

  const data: Record<string, any[]> = {};
  for (const table of TABLES) {
    try {
      const res = await query(`SELECT * FROM ${table}`);
      data[table] = res.rows;
    } catch {
      data[table] = [];
    }
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, `backup-${ts}.json`);
  await fs.writeFile(file, JSON.stringify({ created_at: new Date().toISOString(), tables: data }, null, 2));
  console.log(`[Backup] Saved: ${file}`);

  // Prune old backups — keep newest MAX_BACKUPS
  const entries = (await fs.readdir(BACKUP_DIR))
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort();
  for (const old of entries.slice(0, Math.max(0, entries.length - MAX_BACKUPS))) {
    await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
  }
}

function msUntilHour(hour: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function scheduleBackup(): void {
  const runAndReschedule = async () => {
    try {
      await performBackup();
    } catch (err) {
      console.error('[Backup] Error during backup:', err);
    }
    setTimeout(runAndReschedule, msUntilHour(BACKUP_HOUR));
  };
  const delay = msUntilHour(BACKUP_HOUR);
  setTimeout(runAndReschedule, delay);
  const minutesUntil = Math.round(delay / 60000);
  console.log(`[Backup] Scheduled daily at ${BACKUP_HOUR}:00 (next in ${minutesUntil} min)`);
}

export { performBackup };
