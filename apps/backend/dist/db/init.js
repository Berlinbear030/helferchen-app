"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const pool_1 = require("./pool");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function initDatabase() {
    console.log('Initializing database schema...');
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role VARCHAR(50) NOT NULL DEFAULT 'employee',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS assignments (
      id CHAR(36) NOT NULL,
      customer_id CHAR(36) NOT NULL,
      assigned_user_id CHAR(36),
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at DATETIME NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id CHAR(36) NOT NULL,
      assignment_id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration_minutes INT,
      blocks_count INT,
      total_price DECIMAL(10,2),
      is_signed BOOLEAN DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS signatures (
      id CHAR(36) NOT NULL,
      timelog_id CHAR(36) NOT NULL,
      image_data LONGTEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (timelog_id) REFERENCES time_logs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS reports (
      id CHAR(36) NOT NULL,
      assignment_id CHAR(36) NOT NULL,
      timelog_id CHAR(36) NOT NULL,
      created_by_user_id CHAR(36) NOT NULL,
      notes TEXT,
      signature_id CHAR(36),
      pdf_generated BOOLEAN DEFAULT FALSE,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (timelog_id) REFERENCES time_logs(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id CHAR(36) NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      service_description TEXT NOT NULL,
      preferred_date TEXT,
      preferred_time TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      assigned_user_id CHAR(36),
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    await (0, pool_1.query)(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    console.log('Schema ready. Seeding default users...');
    const adminHash = await bcryptjs_1.default.hash('admin123', 10);
    const boardHash = await bcryptjs_1.default.hash('board2026', 10);
    const empHash = await bcryptjs_1.default.hash('employee123', 10);
    await (0, pool_1.query)(`INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`, ['admin', adminHash, 'Admin User', 'admin@helferchen.info', 'admin']);
    await (0, pool_1.query)(`INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`, ['board', boardHash, 'Board Member', 'board@helferchen.info', 'admin']);
    await (0, pool_1.query)(`INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`, ['employee1', empHash, 'Max Mustermann', 'emp1@helferchen.info', 'employee']);
    console.log('Database initialization complete.');
}
