"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const child_process_1 = require("child_process");
const queries_1 = require("../db/queries");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const MAIL_DOMAIN = 'helferchen.info';
function normalizeLastName(fullName) {
    const last = fullName.trim().split(/\s+/).pop() || fullName;
    return last.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9.-]/g, '');
}
function hashForDovecot(password) {
    const r = (0, child_process_1.spawnSync)('openssl', ['passwd', '-6', password]);
    if (r.status !== 0)
        return '';
    return `{SHA512-CRYPT}${r.stdout.toString().trim()}`;
}
async function createMailAccount(email, password) {
    if (!pool_1.dbConnected)
        return;
    const hash = hashForDovecot(password);
    if (!hash)
        return;
    await (0, pool_1.query)('INSERT IGNORE INTO mail_users (email, password) VALUES (?, ?)', [email, hash]);
}
async function deleteMailAccount(email) {
    if (!pool_1.dbConnected)
        return;
    await (0, pool_1.query)('DELETE FROM mail_users WHERE email = ?', [email]);
}
const router = (0, express_1.Router)();
// All admin routes require admin role
router.use(auth_1.authenticateToken, (0, auth_1.requireRole)('admin'));
// GET /api/admin/users
router.get('/users', async (req, res) => {
    const users = await queries_1.UserRepo.findAll();
    res.json(users);
});
// POST /api/admin/users
router.post('/users', async (req, res) => {
    const { username, password, role, email, full_name } = req.body;
    if (!username || !password || !role)
        return res.status(400).json({ message: 'username, password, role are required' });
    const existing = await queries_1.UserRepo.findByUsername(username);
    if (existing)
        return res.status(409).json({ message: 'Username already exists' });
    const password_hash = await bcryptjs_1.default.hash(password, 10);
    const name = full_name || username;
    const mailLocal = normalizeLastName(name);
    const mailAddress = `${mailLocal}@${MAIL_DOMAIN}`;
    const userEmail = email || mailAddress;
    const user = await queries_1.UserRepo.create(username, password_hash, name, userEmail, role);
    await createMailAccount(mailAddress, password);
    await queries_1.AuditRepo.create('user', user.id, 'created', req.user.id, `User ${username} created with role ${role}, email: ${mailAddress}`);
    res.status(201).json({ id: user.id, username: user.username, role: user.role, email: userEmail, mail_address: mailAddress });
});
// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;
    if (userId === req.user.id)
        return res.status(400).json({ message: 'Cannot delete yourself' });
    const userToDelete = await queries_1.UserRepo.findById(userId);
    const success = await queries_1.UserRepo.delete(userId);
    if (!success)
        return res.status(404).json({ message: 'User not found' });
    if (userToDelete?.email) {
        await deleteMailAccount(userToDelete.email);
        const mailLocal = normalizeLastName(userToDelete.full_name || '');
        if (mailLocal)
            await deleteMailAccount(`${mailLocal}@${MAIL_DOMAIN}`);
    }
    await queries_1.AuditRepo.create('user', userId, 'deleted', req.user.id, 'User deleted');
    res.status(204).send();
});
// GET /api/admin/audit — full audit trail
router.get('/audit', async (req, res) => {
    const entity_type = req.query.entity_type;
    const entity_id = req.query.entity_id;
    const limit = req.query.limit;
    const entries = await queries_1.AuditRepo.findAll({
        entity_type,
        entity_id,
        limit: limit ? parseInt(limit) : undefined
    });
    res.json(entries);
});
// GET /api/admin/export — export all data as JSON
router.get('/export', async (req, res) => {
    await queries_1.AuditRepo.create('system', 'export', 'data_exported', req.user.id, 'Full data export');
    const [users, customers, assignments, timelogs, reports] = await Promise.all([
        queries_1.UserRepo.findAll(),
        queries_1.CustomerRepo.findAll(),
        queries_1.AssignmentRepo.findAll(),
        // Timelog and reports might need more methods but for export we can use these
        Promise.resolve([]), // Placeholder for all timelogs if not yet implemented
        queries_1.ReportRepo.findAll()
    ]);
    res.json({
        exported_at: new Date().toISOString(),
        users,
        customers,
        assignments,
        timelogs,
        reports,
        signatures: [], // Redacted for security in export
    });
});
// GET /api/admin/dashboard — summary stats
router.get('/dashboard', async (req, res) => {
    const [userCount, customerCount, assignmentCount, assignments, reportCount, reports] = await Promise.all([
        queries_1.UserRepo.countAll(),
        queries_1.CustomerRepo.findAll().then(c => c.length),
        queries_1.AssignmentRepo.countAll(),
        queries_1.AssignmentRepo.findAll(),
        queries_1.ReportRepo.findAll().then(r => r.length),
        queries_1.ReportRepo.findAll()
    ]);
    const stats = {
        total_users: userCount,
        total_customers: customerCount,
        total_assignments: assignmentCount,
        assignments_by_status: assignments.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {}),
        total_timelogs: 0, // Placeholder
        active_timers: 0, // Placeholder
        total_reports: reportCount,
        signed_reports: reports.filter(r => r.signature_id).length,
        emails_sent: reports.filter(r => r.email_sent).length,
    };
    res.json(stats);
});
exports.default = router;
