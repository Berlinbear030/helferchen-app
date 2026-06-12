"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBackup = scheduleBackup;
exports.performBackup = performBackup;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const pool_1 = require("../db/pool");
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 30;
const BACKUP_HOUR = 20; // 20:00 server time
const TABLES = [
    'users', 'customers', 'assignments', 'booking_requests',
    'time_logs', 'signatures', 'reports', 'audit_logs', 'roles', 'shop_articles',
];
async function performBackup() {
    if (!pool_1.dbConnected) {
        console.log('[Backup] DB not connected — skipping');
        return;
    }
    const data = {};
    for (const table of TABLES) {
        try {
            const res = await (0, pool_1.query)(`SELECT * FROM ${table}`);
            data[table] = res.rows;
        }
        catch {
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
        await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => { });
    }
}
function msUntilHour(hour) {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next <= now)
        next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
}
function scheduleBackup() {
    const runAndReschedule = async () => {
        try {
            await performBackup();
        }
        catch (err) {
            console.error('[Backup] Error during backup:', err);
        }
        setTimeout(runAndReschedule, msUntilHour(BACKUP_HOUR));
    };
    const delay = msUntilHour(BACKUP_HOUR);
    setTimeout(runAndReschedule, delay);
    const minutesUntil = Math.round(delay / 60000);
    console.log(`[Backup] Scheduled daily at ${BACKUP_HOUR}:00 (next in ${minutesUntil} min)`);
}
