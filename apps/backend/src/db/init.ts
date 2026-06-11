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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Ensure columns exist (for migration)
  try {
    await query('ALTER TABLE assignments ADD COLUMN booking_request_id CHAR(36) AFTER status');
    await query('ALTER TABLE assignments ADD CONSTRAINT fk_booking_request FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id)');
  } catch (e) {}
  try {
    await query('ALTER TABLE assignments ADD COLUMN hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 65.00');
  } catch (e) {}

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
    CREATE TABLE IF NOT EXISTS booking_requests (
      id CHAR(36) NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
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

  // Ensure address column exists (for existing tables)
  try {
    await query('ALTER TABLE booking_requests ADD COLUMN address TEXT AFTER email');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Migrate booking_requests: add separate address fields for sorting by proximity
  const addressCols = ['street', 'house_number', 'zip', 'city'];
  for (const col of addressCols) {
    try {
      await query(`ALTER TABLE booking_requests ADD COLUMN ${col} VARCHAR(255)`);
    } catch (e) {}
  }

  // Migrate users: add address and qualification columns
  try {
    await query('ALTER TABLE users ADD COLUMN address TEXT');
  } catch (e) {}
  try {
    await query('ALTER TABLE users ADD COLUMN qualification TEXT');
  } catch (e) {}

  await query(`
    CREATE TABLE IF NOT EXISTS mail_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  console.log('Seeding sample data for demonstration...');
  const sampleCustId = 'c1111111-1111-1111-1111-111111111111';
  await query(
    `INSERT IGNORE INTO customers (id, first_name, last_name, address, phone_number, notes)
     VALUES (?, 'Erika', 'Mustermann', 'Musterstraße 1, 10115 Berlin', '030-1234567', 'Beispielkunde')`,
    [sampleCustId]
  );

  const sampleAssignId = 'a1111111-1111-1111-1111-111111111111';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10) + ' 10:00:00';
  await query(
    `INSERT IGNORE INTO assignments (id, customer_id, title, description, scheduled_at, status)
     VALUES (?, ?, 'Fensterreinigung', 'Alle Fenster im Erdgeschoss reinigen.', ?, 'pending')`,
    [sampleAssignId, sampleCustId, tomorrowStr]
  );

  const sampleRequestId = 'b1111111-1111-1111-1111-111111111111';
  await query(
    `INSERT IGNORE INTO booking_requests (id, name, phone, email, address, service_description, preferred_date, preferred_time, status)
     VALUES (?, 'Hans Schmidt', '0151-9876543', 'hans@example.com', 'Alexanderplatz 1, 10178 Berlin', 'Hilfe beim Aufbau eines Regals', ?, '14:00', 'open')`,
    [sampleRequestId, tomorrow.toISOString().slice(0, 10)]
  );

  console.log('Database initialization complete.');
}
