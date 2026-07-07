import { query } from './pool';
import bcrypt from 'bcryptjs';
import { spawnSync } from 'child_process';

function hashForDovecot(password: string): string {
  const r = spawnSync('openssl', ['passwd', '-6', password]);
  if (r.status !== 0) return '';
  return `{SHA512-CRYPT}${r.stdout.toString().trim()}`;
}

export async function initDatabase(): Promise<void> {
  console.log('Initializing database schema...');

  await query(`
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

  await query(`
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

  // booking_requests must be created BEFORE assignments (FK dependency)
  await query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id CHAR(36) NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      street VARCHAR(255),
      house_number VARCHAR(255),
      zip VARCHAR(255),
      city VARCHAR(255),
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

  await query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id CHAR(36) NOT NULL,
      customer_id CHAR(36) NOT NULL,
      assigned_user_id CHAR(36),
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at DATETIME NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      booking_request_id CHAR(36),
      hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 65.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: ensure columns added after initial deploy exist on older DBs
  try { await query('ALTER TABLE assignments ADD COLUMN booking_request_id CHAR(36)'); } catch {}
  try { await query('ALTER TABLE assignments ADD CONSTRAINT fk_booking_request FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id)'); } catch {}
  try { await query('ALTER TABLE assignments ADD COLUMN hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 65.00'); } catch {}

  await query(`
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

  await query(`
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

  await query(`
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

  await query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id CHAR(36) NOT NULL,
      report_id CHAR(36) NOT NULL,
      position INT NOT NULL DEFAULT 1,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Invoice columns on reports (migration-safe)
  try { await query('ALTER TABLE reports ADD COLUMN invoice_number VARCHAR(50)'); } catch {}
  try { await query('ALTER TABLE reports ADD COLUMN invoice_notes TEXT'); } catch {}
  try { await query('ALTER TABLE reports ADD COLUMN invoice_amount_override DECIMAL(10,2) NULL'); } catch {}
  // Voucher columns on reports
  try { await query('ALTER TABLE reports ADD COLUMN voucher_code VARCHAR(50) NULL'); } catch {}
  try { await query('ALTER TABLE reports ADD COLUMN voucher_label VARCHAR(255) NULL'); } catch {}
  try { await query('ALTER TABLE reports ADD COLUMN voucher_discount_amount DECIMAL(10,2) NULL'); } catch {}

  await query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id CHAR(36) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
      discount_value DECIMAL(10,2) NOT NULL,
      max_uses INT NULL,
      used_count INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at DATETIME NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS voucher_usages (
      id CHAR(36) NOT NULL,
      voucher_id CHAR(36) NOT NULL,
      report_id CHAR(36) NOT NULL,
      discount_amount DECIMAL(10,2) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      UNIQUE KEY unique_report_voucher (report_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // EIS-365: payment method and due days on invoices
  try { await query("ALTER TABLE reports ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'bar'"); } catch {}
  try { await query('ALTER TABLE reports ADD COLUMN payment_due_days INT NULL DEFAULT 14'); } catch {}

  // booking_requests migration: ensure all columns exist on older deployments
  for (const col of ['street', 'house_number', 'zip', 'city']) {
    try { await query(`ALTER TABLE booking_requests ADD COLUMN ${col} VARCHAR(255)`); } catch {}
  }

  // Migrate users: add address, qualification, permissions, and soft-delete columns
  try {
    await query('ALTER TABLE users ADD COLUMN address TEXT');
  } catch (e) {}
  try {
    await query('ALTER TABLE users ADD COLUMN qualification TEXT');
  } catch (e) {}
  try {
    await query("ALTER TABLE users ADD COLUMN permissions TEXT NULL"); // MySQL 8: no DEFAULT on TEXT
  } catch (e) {}
  // Populate permissions for any rows added before this migration
  try {
    await query("UPDATE users SET permissions = '[]' WHERE permissions IS NULL");
  } catch (e) {}
  try {
    await query('ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL');
  } catch (e) {}

  await query(`
    CREATE TABLE IF NOT EXISTS mail_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: add active column if missing (EIS-364 fix)
  try {
    await query('ALTER TABLE mail_users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1');
    await query('UPDATE mail_users SET active = 1 WHERE active IS NULL');
  } catch (e) {}

  await query(`
    CREATE TABLE IF NOT EXISTS mail_aliases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY unique_source (source)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shop_articles (
      id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      image_url TEXT,
      stock INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
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

  await query(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      caller_id VARCHAR(50) NOT NULL,
      unique_id VARCHAR(100) NULL,
      status ENUM('missed','answered','callback_initiated','handled') NOT NULL DEFAULT 'missed',
      note TEXT NULL,
      handled_by CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sip_users (
      id CHAR(36) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id CHAR(36) NOT NULL,
      name VARCHAR(100) UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      permissions TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed built-in system roles if they don't exist yet
  const systemRoles = [
    { name: 'admin', display_name: 'Administrator', permissions: JSON.stringify(['*']) },
    { name: 'gebietsleiter', display_name: 'Gebietsleiter', permissions: JSON.stringify(['view_assignments','manage_assignments','reassign_assignments','view_customers','manage_customers','view_reports','view_timelogs','view_booking_requests','manage_booking_requests']) },
    { name: 'kundenbetreuer', display_name: 'Kundenbetreuer', permissions: JSON.stringify(['view_assignments','manage_assignments','view_customers','view_reports','view_timelogs','view_booking_requests']) },
    { name: 'buchhaltung', display_name: 'Buchhaltung', permissions: JSON.stringify(['view_assignments','view_customers','view_reports','view_timelogs']) },
    { name: 'mitarbeiter', display_name: 'Mitarbeiter', permissions: JSON.stringify(['view_assignments','view_timelogs']) },
    { name: 'employee', display_name: 'Mitarbeiter (Standard)', permissions: JSON.stringify(['view_assignments','view_timelogs']) },
  ];
  for (const r of systemRoles) {
    await query(
      `INSERT IGNORE INTO roles (id, name, display_name, is_system, permissions) VALUES (UUID(), ?, ?, TRUE, ?)`,
      [r.name, r.display_name, r.permissions]
    );
  }

  console.log('Schema ready. Seeding default users...');

  const adminHash = await bcrypt.hash('admin123', 10);
  const boardHash = await bcrypt.hash('board2026', 10);
  const empHash = await bcrypt.hash('employee123', 10);

  await query(
    `INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`,
    ['admin', adminHash, 'Admin User', 'admin@helferchen.info', 'admin']
  );
  await query(
    `INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`,
    ['board', boardHash, 'Board Member', 'board@helferchen.info', 'admin']
  );
  await query(
    `INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role)
     VALUES (UUID(), ?, ?, ?, ?, ?)`,
    ['employee1', empHash, 'Max Mustermann', 'emp1@helferchen.info', 'employee']
  );

  console.log('Seeding standard mail accounts...');
  const mailPass = 'Helferchen2026!';
  const mailHash = hashForDovecot(mailPass);
  if (mailHash) {
    const stdEmails = ['info@helferchen.info', 'kundenservice@helferchen.info', 'no-reply@helferchen.info', 'shop@helferchen.info'];
    for (const email of stdEmails) {
      await query('INSERT IGNORE INTO mail_users (email, password) VALUES (?, ?)', [email, mailHash]);
    }
  }

  console.log('Database initialization complete.');
}
