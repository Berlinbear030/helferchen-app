"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./pool");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seed() {
    const adminHash = await bcryptjs_1.default.hash('admin123', 10);
    const boardHash = await bcryptjs_1.default.hash('board2026', 10);
    const empHash = await bcryptjs_1.default.hash('employee123', 10);
    console.log('Seeding users...');
    await (0, pool_1.query)('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', ['admin', adminHash, 'Admin User', 'admin']);
    await (0, pool_1.query)('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', ['board', boardHash, 'Board Member', 'admin']);
    await (0, pool_1.query)('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING', ['employee1', empHash, 'Max Mustermann', 'employee']);
    console.log('Seeding customers...');
    await (0, pool_1.query)('INSERT INTO customers (first_name, last_name, address, phone_number) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', ['Erika', 'Mustermann', 'Musterstr. 1, 80333 München', '089-123456']);
    console.log('Seed complete!');
    process.exit(0);
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
