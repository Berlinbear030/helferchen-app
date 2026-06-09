"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAudit = addAudit;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const adminHash = bcryptjs_1.default.hashSync('admin123', 10);
const boardHash = bcryptjs_1.default.hashSync('board2026', 10);
const empHash = bcryptjs_1.default.hashSync('employee123', 10);
const db = {
    users: [
        { id: 'u1', username: 'admin', password_hash: adminHash, role: 'admin', email: 'admin@helferchen.info', full_name: 'Admin User', created_at: new Date().toISOString() },
        { id: 'u3', username: 'board', password_hash: boardHash, role: 'admin', email: 'board@helferchen.info', full_name: 'Board Member', created_at: new Date().toISOString() },
        { id: 'u2', username: 'employee1', password_hash: empHash, role: 'employee', email: 'emp1@helferchen.info', full_name: 'Max Mustermann', created_at: new Date().toISOString() },
    ],
    customers: [
        { id: 'c1', first_name: 'Erika', last_name: 'Mustermann', address: 'Musterstr. 1, 80333 München', phone_number: '089-123456', notes: 'Erdgeschoss', created_at: new Date().toISOString() },
        { id: 'c2', first_name: 'Hans', last_name: 'Schmidt', address: 'Hauptstr. 5, 80335 München', phone_number: '089-654321', notes: '3. OG', created_at: new Date().toISOString() },
    ],
    assignments: [
        { id: 'a1', customer_id: 'c1', assigned_user_id: 'u2', title: 'TV einrichten', description: 'Samsung TV im Wohnzimmer', scheduled_at: new Date().toISOString(), status: 'pending', created_at: new Date().toISOString() },
        { id: 'a2', customer_id: 'c2', assigned_user_id: 'u2', title: 'Fenster putzen', description: '3 Fenster', scheduled_at: new Date().toISOString(), status: 'pending', created_at: new Date().toISOString() },
    ],
    timelogs: [],
    signatures: [],
    reports: [],
    audit: [],
    bookingRequests: [],
};
function addAudit(entity_type, entity_id, action, actor_user_id, details) {
    db.audit.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        entity_type,
        entity_id,
        action,
        actor_user_id,
        details,
        timestamp: new Date().toISOString(),
    });
}
exports.default = db;
