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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importStar(require("./pool"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seed() {
    const connected = await (0, pool_1.testConnection)();
    if (!connected) {
        throw new Error('Could not connect to database');
    }
    const adminHash = await bcryptjs_1.default.hash('admin123', 10);
    const boardHash = await bcryptjs_1.default.hash('board2026', 10);
    const empHash = await bcryptjs_1.default.hash('employee123', 10);
    const userAdminId = 'f47ac10b-58cc-4372-a567-0e02b2c3d470';
    const userBoardId = 'f47ac10b-58cc-4372-a567-0e02b2c3d471';
    const userEmployee1Id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const customerErikaId = 'a9e1c5a9-60b6-4469-83a3-0a459a7ec3e8';
    console.log('Seeding users...');
    await (0, pool_1.query)('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [userAdminId, 'admin', adminHash, 'Admin User', 'admin']);
    await (0, pool_1.query)('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [userBoardId, 'board', boardHash, 'Board Member', 'admin']);
    await (0, pool_1.query)('INSERT IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [userEmployee1Id, 'employee1', empHash, 'Max Mustermann', 'employee']);
    console.log('Seeding customers...');
    await (0, pool_1.query)('INSERT IGNORE INTO customers (id, first_name, last_name, address, phone_number) VALUES (?, ?, ?, ?, ?)', [customerErikaId, 'Erika', 'Mustermann', 'Musterstr. 1, 80333 München', '089-123456']);
    console.log('Seeding assignments...');
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    await (0, pool_1.query)('INSERT IGNORE INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)', ['b5a9c2c6-3d7e-4b7c-a7a7-3e1d5e6f5d8e', customerErikaId, userEmployee1Id, 'Einkaufen gehen', 'Milch, Brot, Eier', today, 'pending']);
    await (0, pool_1.query)('INSERT IGNORE INTO assignments (id, customer_id, assigned_user_id, title, description, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)', ['c8e7e4a5-9e1d-4f5b-9f5c-8d3f7e6a4b2a', customerErikaId, userEmployee1Id, 'Arzttermin Begleitung', 'Zum Hausarzt Dr. Schmidt', tomorrow, 'pending']);
    console.log('Seed complete!');
}
seed()
    .catch(err => {
    console.error(err);
    process.exit(1);
})
    .finally(() => {
    pool_1.default?.end();
    process.exit(0);
});
