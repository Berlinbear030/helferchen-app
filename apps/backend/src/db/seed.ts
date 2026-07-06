import { query, testConnection, default as pool } from './pool';
import bcrypt from 'bcryptjs';

async function seed() {
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Could not connect to database');
  }

  const adminHash = await bcrypt.hash('admin123', 10);
  const boardHash = await bcrypt.hash('board2026', 10);
  const empHash = await bcrypt.hash('employee123', 10);

  const userAdminId = 'f47ac10b-58cc-4372-a567-0e02b2c3d470';
  const userBoardId = 'f47ac10b-58cc-4372-a567-0e02b2c3d471';
  const userEmployee1Id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const customerErikaId = 'a9e1c5a9-60b6-4469-83a3-0a459a7ec3e8';

  console.log('Seeding users...');
  await query('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', 
    [userAdminId, 'admin', adminHash, 'Admin User', 'admin']);
  await query('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    [userBoardId, 'board', boardHash, 'Board Member', 'admin']);
  await query('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    [userEmployee1Id, 'employee1', empHash, 'Max Mustermann', 'employee']);

  console.log('Seeding customers...');
  await query('INSERT IGNORE INTO customers (id, first_name, last_name, address, phone_number) VALUES (?, ?, ?, ?, ?)',
    [customerErikaId, 'Erika', 'Mustermann', 'Musterstr. 1, 80333 München', '089-123456']);

  console.log('Seeding assignments...');
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  await query('INSERT IGNORE INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['b5a9c2c6-3d7e-4b7c-a7a7-3e1d5e6f5d8e', customerErikaId, userEmployee1Id, 'Einkaufen gehen', 'Milch, Brot, Eier', today, 'pending']);
  await query('INSERT IGNORE INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['c8e7e4a5-9e1d-4f5b-9f5c-8d3f7e6a4b2a', customerErikaId, userEmployee1Id, 'Arzttermin Begleitung', 'Zum Hausarzt Dr. Schmidt', tomorrow, 'pending']);

  console.log('Seed complete!');
}

seed()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    pool?.end();
    process.exit(0);
  });
