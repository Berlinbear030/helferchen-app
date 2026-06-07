import { query } from './pool';
import bcrypt from 'bcryptjs';

export async function initDatabase(): Promise<void> {
  console.log('Initializing database schema...');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id),
      assigned_user_id UUID REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id UUID NOT NULL REFERENCES assignments(id),
      user_id UUID NOT NULL REFERENCES users(id),
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE,
      duration_minutes INTEGER,
      blocks_count INTEGER,
      total_price DECIMAL(10, 2),
      is_signed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS signatures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timelog_id UUID NOT NULL REFERENCES time_logs(id),
      image_data TEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id UUID NOT NULL REFERENCES assignments(id),
      timelog_id UUID NOT NULL REFERENCES time_logs(id),
      created_by_user_id UUID NOT NULL REFERENCES users(id),
      notes TEXT,
      signature_id UUID REFERENCES signatures(id),
      pdf_generated BOOLEAN DEFAULT FALSE,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      service_description TEXT NOT NULL,
      preferred_date TEXT,
      preferred_time TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_user_id UUID REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Schema ready. Seeding default users...');

  const adminHash = await bcrypt.hash('admin123', 10);
  const boardHash = await bcrypt.hash('board2026', 10);
  const empHash = await bcrypt.hash('employee123', 10);

  await query(
    `INSERT INTO users (username, password_hash, full_name, email, role)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
    ['admin', adminHash, 'Admin User', 'admin@helferchen.info', 'admin']
  );
  await query(
    `INSERT INTO users (username, password_hash, full_name, email, role)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
    ['board', boardHash, 'Board Member', 'board@helferchen.info', 'admin']
  );
  await query(
    `INSERT INTO users (username, password_hash, full_name, email, role)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
    ['employee1', empHash, 'Max Mustermann', 'emp1@helferchen.info', 'employee']
  );

  console.log('Database initialization complete.');
}
