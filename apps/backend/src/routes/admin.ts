import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepo, AuditRepo, CustomerRepo, AssignmentRepo, TimelogRepo, ReportRepo, SignatureRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

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
  const user = await UserRepo.create(username, password_hash, full_name || username, email || '', role);
  
  await AuditRepo.create('user', user.id, 'created', req.user!.id, `User ${username} created with role ${role}`);
  res.status(201).json({ id: user.id, username: user.username, role: user.role });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  if (userId === req.user!.id) return res.status(400).json({ message: 'Cannot delete yourself' });
  
  const success = await UserRepo.delete(userId);
  if (!success) return res.status(404).json({ message: 'User not found' });
  
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

export default router;
