import { query } from './pool';
import bcrypt from 'bcryptjs';

async function seed() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const boardHash = await bcrypt.hash('board2026', 10);
  const empHash = await bcrypt.hash('employee123', 10);

  console.log('Seeding users...');
  await query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', 
    ['admin', adminHash, 'Admin User', 'admin']);
  await query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', 
    ['board', boardHash, 'Board Member', 'admin']);
  await query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', 
    ['employee1', empHash, 'Max Mustermann', 'employee']);

  console.log('Seeding customers...');
  await query('INSERT INTO customers (first_name, last_name, address, phone_number) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', 
    ['Erika', 'Mustermann', 'Musterstr. 1, 80333 München', '089-123456']);

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
