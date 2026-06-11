import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { spawnSync } from 'child_process';
import { UserRepo, AuditRepo, CustomerRepo, AssignmentRepo, TimelogRepo, ReportRepo, SignatureRepo, RoleRepo } from '../db/queries';
import { query, dbConnected } from '../db/pool';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const MAIL_DOMAIN = 'helferchen.info';

function normalizeLastName(fullName: string): string {
  const last = fullName.trim().split(/\s+/).pop() || fullName;
  return last.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.-]/g, '');
}

function hashForDovecot(password: string): string {
  const r = spawnSync('openssl', ['passwd', '-6', password]);
  if (r.status !== 0) return '';
  return `{SHA512-CRYPT}${r.stdout.toString().trim()}`;
}

async function createMailAccount(email: string, password: string): Promise<void> {
  if (!dbConnected) return;
  const hash = hashForDovecot(password);
  if (!hash) return;
  await query('INSERT IGNORE INTO mail_users (email, password) VALUES (?, ?)', [email, hash]);
}

async function deleteMailAccount(email: string): Promise<void> {
  if (!dbConnected) return;
  await query('DELETE FROM mail_users WHERE email = ?', [email]);
}

const router = Router();

// All admin routes require admin role
router.use(authenticateToken, requireRole('admin'));

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res: Response) => {
  const users = await UserRepo.findAll();
  res.json(users);
});

// POST /api/admin/users
router.post('/users', async (req: AuthRequest, res: Response) => {
  const { username, password, role, email, full_name } = req.body;
  if (!username || !password || !role) return res.status(400).json({ message: 'username, password, role are required' });

  const existing = await UserRepo.findByUsername(username);
  if (existing) return res.status(409).json({ message: 'Username already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const name = full_name || username;
  const mailLocal = normalizeLastName(name);
  const mailAddress = `${mailLocal}@${MAIL_DOMAIN}`;
  const userEmail = email || mailAddress;

  const user = await UserRepo.create(username, password_hash, name, userEmail, role);
  await createMailAccount(mailAddress, password);

  await AuditRepo.create('user', user.id, 'created', req.user!.id, `User ${username} created with role ${role}, email: ${mailAddress}`);
  res.status(201).json({ id: user.id, username: user.username, role: user.role, email: userEmail, mail_address: mailAddress });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  if (userId === req.user!.id) return res.status(400).json({ message: 'Cannot delete yourself' });

  const userToDelete = await UserRepo.findById(userId);
  const success = await UserRepo.delete(userId);
  if (!success) return res.status(404).json({ message: 'User not found' });

  if (userToDelete?.email) {
    await deleteMailAccount(userToDelete.email);
    const mailLocal = normalizeLastName(userToDelete.full_name || '');
    if (mailLocal) await deleteMailAccount(`${mailLocal}@${MAIL_DOMAIN}`);
  }

  await AuditRepo.create('user', userId, 'deleted', req.user!.id, 'User deleted');
  res.status(204).send();
});

// GET /api/admin/audit — full audit trail
router.get('/audit', async (req: AuthRequest, res: Response) => {
  const entity_type = req.query.entity_type as string | undefined;
  const entity_id = req.query.entity_id as string | undefined;
  const limit = req.query.limit as string | undefined;
  
  const entries = await AuditRepo.findAll({
    entity_type,
    entity_id,
    limit: limit ? parseInt(limit) : undefined
  });
  res.json(entries);
});

// GET /api/admin/export — export all data as JSON
router.get('/export', async (req: AuthRequest, res: Response) => {
  await AuditRepo.create('system', 'export', 'data_exported', req.user!.id, 'Full data export');
  
  const [users, customers, assignments, timelogs, reports] = await Promise.all([
    UserRepo.findAll(),
    CustomerRepo.findAll(),
    AssignmentRepo.findAll(),
    // Timelog and reports might need more methods but for export we can use these
    Promise.resolve([]), // Placeholder for all timelogs if not yet implemented
    ReportRepo.findAll()
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
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const [userCount, customerCount, assignmentCount, assignments, reportCount, reports] = await Promise.all([
    UserRepo.countAll(),
    CustomerRepo.findAll().then(c => c.length),
    AssignmentRepo.countAll(),
    AssignmentRepo.findAll(),
    ReportRepo.findAll().then(r => r.length),
    ReportRepo.findAll()
  ]);

  const stats = {
    total_users: userCount,
    total_customers: customerCount,
    total_assignments: assignmentCount,
    assignments_by_status: assignments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    total_timelogs: 0, // Placeholder
    active_timers: 0, // Placeholder
    total_reports: reportCount,
    signed_reports: reports.filter(r => r.signature_id).length,
    emails_sent: reports.filter(r => r.email_sent).length,
  };

  res.json(stats);
});

// GET /api/admin/roles — list all roles
router.get('/roles', async (req: AuthRequest, res: Response) => {
  const roles = await RoleRepo.findAll();
  res.json(roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') })));
});

// POST /api/admin/roles — create a custom role
router.post('/roles', async (req: AuthRequest, res: Response) => {
  const { name, display_name, permissions } = req.body;
  if (!name || !display_name) return res.status(400).json({ message: 'name and display_name are required' });
  const existing = await RoleRepo.findByName(name);
  if (existing) return res.status(409).json({ message: 'Role name already exists' });
  const role = await RoleRepo.create(String(name), String(display_name), Array.isArray(permissions) ? permissions : []);
  await AuditRepo.create('role', role.id, 'created', req.user!.id, `Role ${name} created`);
  res.status(201).json({ ...role, permissions: JSON.parse(role.permissions) });
});

// PATCH /api/admin/roles/:id — update role display_name and permissions
router.patch('/roles/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { display_name, permissions } = req.body;
  const role = await RoleRepo.findById(id as string);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.is_system && role.name === 'admin') return res.status(403).json({ message: 'Cannot modify admin role permissions' });
  const ok = await RoleRepo.update(id as string, display_name || role.display_name, Array.isArray(permissions) ? permissions : JSON.parse(role.permissions || '[]'));
  if (!ok) return res.status(404).json({ message: 'Role not found' });
  await AuditRepo.create('role', id as string, 'updated', req.user!.id, `Role ${role.name} updated`);
  res.json({ message: 'Updated' });
});

// DELETE /api/admin/roles/:id — delete a custom role
router.delete('/roles/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const role = await RoleRepo.findById(id as string);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.is_system) return res.status(403).json({ message: 'Cannot delete system roles' });
  const ok = await RoleRepo.delete(id as string);
  if (!ok) return res.status(404).json({ message: 'Role not found or is system role' });
  await AuditRepo.create('role', id as string, 'deleted', req.user!.id, `Role ${role.name} deleted`);
  res.status(204).send();
});

// GET /api/admin/users/:id — get single user
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  const user = await UserRepo.findById(req.params.id as string);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password_hash: _, ...safeUser } = user as any;
  res.json(safeUser);
});

// GET /api/admin/users/:id/stats — employee work history and earnings
router.get('/users/:id/stats', async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  const user = await UserRepo.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const [timelogs, assignments] = await Promise.all([
    TimelogRepo.findByUserId(userId),
    AssignmentRepo.findByUserId(userId),
  ]);

  const customerIds = [...new Set(assignments.map(a => a.customer_id))];
  const customers = await Promise.all(customerIds.map(id => CustomerRepo.findById(id)));
  const customerMap: Record<string, string> = {};
  for (const c of customers) {
    if (c) customerMap[c.id] = `${c.first_name} ${c.last_name}`;
  }

  const assignmentMap: Record<string, { title: string; customer_id: string }> = {};
  for (const a of assignments) {
    assignmentMap[a.id] = { title: a.title, customer_id: a.customer_id };
  }

  const enrichedTimelogs = timelogs.map(t => ({
    ...t,
    assignment_title: assignmentMap[t.assignment_id]?.title ?? null,
    customer_name: assignmentMap[t.assignment_id] ? customerMap[assignmentMap[t.assignment_id].customer_id] ?? null : null,
  }));

  const totalEarnings = timelogs.reduce((sum, t) => sum + (parseFloat(String(t.total_price ?? '0')) || 0), 0);

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
router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
  const { role, password, email, full_name, address, qualification } = req.body;
  const user = await UserRepo.findById(req.params.id as string);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updateFields: Parameters<typeof UserRepo.update>[1] = {};
  const changes: string[] = [];

  if (role !== undefined) { updateFields.role = role; changes.push(`role=${role}`); }
  if (full_name !== undefined) { updateFields.full_name = full_name; changes.push('full_name updated'); }
  if (email !== undefined) { updateFields.email = email; changes.push('email updated'); }
  if (address !== undefined) { updateFields.address = address; changes.push('address updated'); }
  if (qualification !== undefined) { updateFields.qualification = qualification; changes.push('qualification updated'); }
  if (password) {
    updateFields.password_hash = await bcrypt.hash(password, 10);
    changes.push('password changed');
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  await UserRepo.update(req.params.id as string, updateFields);
  await AuditRepo.create('user', req.params.id as string, 'updated', req.user!.id, changes.join(', '));
  res.json({ message: 'Updated' });
});

export default router;
