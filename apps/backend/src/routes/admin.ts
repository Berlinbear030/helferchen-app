import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(authenticateToken, requireRole('admin'));

// GET /api/admin/users
router.get('/users', (req: AuthRequest, res: Response) => {
  res.json(db.users.map(u => ({ id: u.id, username: u.username, role: u.role, email: u.email, full_name: u.full_name, created_at: u.created_at })));
});

// POST /api/admin/users
router.post('/users', async (req: AuthRequest, res: Response) => {
  const { username, password, role, email, full_name } = req.body;
  if (!username || !password || !role) return res.status(400).json({ message: 'username, password, role are required' });

  const existing = db.users.find(u => u.username === username);
  if (existing) return res.status(409).json({ message: 'Username already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    username,
    password_hash,
    role: role as 'admin' | 'employee',
    email: email || '',
    full_name: full_name || username,
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  addAudit('user', user.id, 'created', req.user!.id, `User ${username} created with role ${role}`);
  res.status(201).json({ id: user.id, username: user.username, role: user.role });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  if (userId === req.user!.id) return res.status(400).json({ message: 'Cannot delete yourself' });
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ message: 'User not found' });
  db.users.splice(idx, 1);
  addAudit('user', userId, 'deleted', req.user!.id, 'User deleted');
  res.status(204).send();
});

// GET /api/admin/audit — full audit trail
router.get('/audit', (req: AuthRequest, res: Response) => {
  const entity_type = req.query.entity_type as string | undefined;
  const entity_id = req.query.entity_id as string | undefined;
  const limit = req.query.limit as string | undefined;
  let entries = [...db.audit].reverse();
  if (entity_type) entries = entries.filter(e => e.entity_type === entity_type);
  if (entity_id) entries = entries.filter(e => e.entity_id === entity_id);
  if (limit) entries = entries.slice(0, parseInt(limit));
  res.json(entries);
});

// GET /api/admin/export — export all data as JSON
router.get('/export', (req: AuthRequest, res: Response) => {
  addAudit('system', 'export', 'data_exported', req.user!.id, 'Full data export');
  res.json({
    exported_at: new Date().toISOString(),
    users: db.users.map(u => ({ id: u.id, username: u.username, role: u.role, email: u.email, full_name: u.full_name })),
    customers: db.customers,
    assignments: db.assignments,
    timelogs: db.timelogs,
    reports: db.reports,
    signatures: db.signatures.map(s => ({ ...s, image_data: '[redacted]' })),
  });
});

// GET /api/admin/dashboard — summary stats
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  res.json({
    total_users: db.users.length,
    total_customers: db.customers.length,
    total_assignments: db.assignments.length,
    assignments_by_status: db.assignments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    total_timelogs: db.timelogs.length,
    active_timers: db.timelogs.filter(t => !t.end_time).length,
    total_reports: db.reports.length,
    signed_reports: db.reports.filter(r => r.signature_id).length,
    emails_sent: db.reports.filter(r => r.email_sent).length,
  });
});

export default router;
