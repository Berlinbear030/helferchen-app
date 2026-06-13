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
    try {
        const userId = req.params.id;
        if (userId === req.user.id)
            return res.status(400).json({ message: 'Cannot delete yourself' });
        const userToDelete = await queries_1.UserRepo.findById(userId);
        if (!userToDelete)
            return res.status(404).json({ message: 'User not found' });
        if (userToDelete.deleted_at)
            return res.status(404).json({ message: 'User not found' });
        // Unassign this employee from any open assignments (nullable FK — safe to nullify)
        await (0, pool_1.query)("UPDATE assignments SET assigned_user_id = NULL WHERE assigned_user_id = ? AND status IN ('pending','in_progress')", [userId]);
        await (0, pool_1.query)("UPDATE booking_requests SET assigned_user_id = NULL WHERE assigned_user_id = ?", [userId]);
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
    }
    catch (err) {
        console.error('DELETE /admin/users error:', err);
        res.status(500).json({ message: 'Fehler beim Löschen des Mitarbeiters', detail: err.message });
    }
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
// GET /api/admin/roles — list all roles
router.get('/roles', async (req, res) => {
    const roles = await queries_1.RoleRepo.findAll();
    res.json(roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') })));
});
// POST /api/admin/roles — create a custom role
router.post('/roles', async (req, res) => {
    const { name, display_name, permissions } = req.body;
    if (!name || !display_name)
        return res.status(400).json({ message: 'name and display_name are required' });
    const existing = await queries_1.RoleRepo.findByName(name);
    if (existing)
        return res.status(409).json({ message: 'Role name already exists' });
    const role = await queries_1.RoleRepo.create(String(name), String(display_name), Array.isArray(permissions) ? permissions : []);
    await queries_1.AuditRepo.create('role', role.id, 'created', req.user.id, `Role ${name} created`);
    res.status(201).json({ ...role, permissions: JSON.parse(role.permissions) });
});
// PATCH /api/admin/roles/:id — update role display_name and permissions
router.patch('/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { display_name, permissions } = req.body;
    const role = await queries_1.RoleRepo.findById(id);
    if (!role)
        return res.status(404).json({ message: 'Role not found' });
    if (role.is_system && role.name === 'admin')
        return res.status(403).json({ message: 'Cannot modify admin role permissions' });
    const ok = await queries_1.RoleRepo.update(id, display_name || role.display_name, Array.isArray(permissions) ? permissions : JSON.parse(role.permissions || '[]'));
    if (!ok)
        return res.status(404).json({ message: 'Role not found' });
    await queries_1.AuditRepo.create('role', id, 'updated', req.user.id, `Role ${role.name} updated`);
    res.json({ message: 'Updated' });
});
// DELETE /api/admin/roles/:id — delete a custom role
router.delete('/roles/:id', async (req, res) => {
    const { id } = req.params;
    const role = await queries_1.RoleRepo.findById(id);
    if (!role)
        return res.status(404).json({ message: 'Role not found' });
    if (role.is_system)
        return res.status(403).json({ message: 'Cannot delete system roles' });
    const ok = await queries_1.RoleRepo.delete(id);
    if (!ok)
        return res.status(404).json({ message: 'Role not found or is system role' });
    await queries_1.AuditRepo.create('role', id, 'deleted', req.user.id, `Role ${role.name} deleted`);
    res.status(204).send();
});
// GET /api/admin/users/:id — get single user
router.get('/users/:id', async (req, res) => {
    const user = await queries_1.UserRepo.findById(req.params.id);
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    const { password_hash: _, ...safeUser } = user;
    res.json(safeUser);
});
// GET /api/admin/users/:id/stats — employee work history and earnings
router.get('/users/:id/stats', async (req, res) => {
    const userId = req.params.id;
    const user = await queries_1.UserRepo.findById(userId);
    if (!user)
        return res.status(404).json({ message: 'User not found' });
    const [timelogs, assignments] = await Promise.all([
        queries_1.TimelogRepo.findByUserId(userId),
        queries_1.AssignmentRepo.findByUserId(userId),
    ]);
    const customerIds = [...new Set(assignments.map(a => a.customer_id))];
    const customers = await Promise.all(customerIds.map(id => queries_1.CustomerRepo.findById(id)));
    const customerMap = {};
    for (const c of customers) {
        if (c)
            customerMap[c.id] = `${c.first_name} ${c.last_name}`;
    }
    const assignmentMap = {};
    for (const a of assignments) {
        assignmentMap[a.id] = { title: a.title, customer_id: a.customer_id };
    }
    // Fetch invoiced prices per timelog (applies invoice_amount_override and voucher discounts)
    let invoicedPriceMap = {};
    if (pool_1.dbConnected && timelogs.length > 0) {
        const ph = timelogs.map(() => '?').join(',');
        const invoicedRes = await (0, pool_1.query)(`
      SELECT tl.id,
        GREATEST(0,
          COALESCE(r.invoice_amount_override,
            CASE
              WHEN tl.total_price IS NOT NULL THEN tl.total_price
              WHEN tl.duration_minutes IS NOT NULL AND tl.duration_minutes <= 15 THEN 20
              WHEN tl.duration_minutes IS NOT NULL THEN 20 + CEIL((tl.duration_minutes - 15.0) / 15) * 15
              ELSE 0
            END
          ) - COALESCE(r.voucher_discount_amount, 0)
        ) as invoiced_price
      FROM time_logs tl
      LEFT JOIN reports r ON r.timelog_id = tl.id
      WHERE tl.id IN (${ph})
    `, timelogs.map(t => t.id));
        for (const row of invoicedRes.rows) {
            invoicedPriceMap[row.id] = parseFloat(row.invoiced_price) || 0;
        }
    }
    const enrichedTimelogs = timelogs.map(t => ({
        ...t,
        assignment_title: assignmentMap[t.assignment_id]?.title ?? null,
        customer_name: assignmentMap[t.assignment_id] ? customerMap[assignmentMap[t.assignment_id].customer_id] ?? null : null,
        total_price: pool_1.dbConnected ? (invoicedPriceMap[t.id] ?? t.total_price) : t.total_price,
    }));
    let totalEarnings = 0;
    if (pool_1.dbConnected) {
        const earningsRes = await (0, pool_1.query)(`
      SELECT SUM(GREATEST(0,
        COALESCE(r.invoice_amount_override,
          CASE
            WHEN tl.total_price IS NOT NULL THEN tl.total_price
            WHEN tl.duration_minutes IS NOT NULL AND tl.duration_minutes <= 15 THEN 20
            WHEN tl.duration_minutes IS NOT NULL THEN 20 + CEIL((tl.duration_minutes - 15.0) / 15) * 15
            ELSE 0
          END
        ) - COALESCE(r.voucher_discount_amount, 0)
      )) as total_earnings
      FROM time_logs tl
      LEFT JOIN reports r ON r.timelog_id = tl.id
      WHERE tl.user_id = ? AND tl.end_time IS NOT NULL
    `, [userId]);
        totalEarnings = parseFloat(earningsRes.rows[0]?.total_earnings ?? '0') || 0;
    }
    else {
        totalEarnings = timelogs.reduce((sum, t) => sum + (parseFloat(String(t.total_price ?? '0')) || 0), 0);
    }
    res.json({
        total_assignments: assignments.length,
        completed_assignments: assignments.filter(a => a.status === 'completed').length,
        total_timelogs: timelogs.length,
        total_earnings: totalEarnings,
        timelogs: enrichedTimelogs,
        assignments: assignments.map(a => ({ ...a, customer_name: customerMap[a.customer_id] ?? null })),
    });
});
// PATCH /api/admin/users/:id — update user (all editable fields)
router.patch('/users/:id', async (req, res) => {
    try {
        const { role, password, email, full_name, address, qualification, permissions } = req.body;
        const user = await queries_1.UserRepo.findById(req.params.id);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        if (user.deleted_at)
            return res.status(404).json({ message: 'User not found' });
        const updateFields = {};
        const changes = [];
        if (role !== undefined) {
            updateFields.role = role;
            changes.push(`role=${role}`);
        }
        if (full_name !== undefined) {
            updateFields.full_name = full_name;
            changes.push('full_name updated');
        }
        if (email !== undefined) {
            updateFields.email = email;
            changes.push('email updated');
        }
        if (address !== undefined) {
            updateFields.address = address;
            changes.push('address updated');
        }
        if (qualification !== undefined) {
            updateFields.qualification = qualification;
            changes.push('qualification updated');
        }
        if (permissions !== undefined) {
            updateFields.permissions = JSON.stringify(Array.isArray(permissions) ? permissions : []);
            changes.push('permissions updated');
        }
        if (password) {
            updateFields.password_hash = await bcryptjs_1.default.hash(password, 10);
            changes.push('password changed');
        }
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        await queries_1.UserRepo.update(req.params.id, updateFields);
        // Sync mail password when portal password changes
        if (password) {
            const freshUser = await queries_1.UserRepo.findById(req.params.id);
            const mailLocal = normalizeLastName(freshUser?.full_name || '');
            if (mailLocal) {
                const mailAddress = `${mailLocal}@${MAIL_DOMAIN}`;
                const hash = hashForDovecot(password);
                if (hash) {
                    await (0, pool_1.query)('UPDATE mail_users SET password = ? WHERE email = ?', [hash, mailAddress]);
                }
            }
        }
        await queries_1.AuditRepo.create('user', req.params.id, 'updated', req.user.id, changes.join(', '));
        res.json({ message: 'Updated' });
    }
    catch (err) {
        console.error('PATCH /admin/users error:', err);
        res.status(500).json({ message: 'Fehler beim Aktualisieren des Mitarbeiters', detail: err.message });
    }
});
// GET /api/admin/mail-users — list all mail accounts (email only, no password hashes)
router.get('/mail-users', async (_req, res) => {
    try {
        const rows = await (0, pool_1.query)('SELECT email, created_at FROM mail_users ORDER BY email');
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: 'Fehler beim Laden der Mailkonten', detail: err.message });
    }
});
exports.default = router;
