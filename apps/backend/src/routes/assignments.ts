import { Router, Response } from 'express';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const result = db.assignments.map(a => {
    const customer = db.customers.find(c => c.id === a.customer_id);
    const user = db.users.find(u => u.id === a.assigned_user_id);
    return { ...a, customer, assigned_user: user ? { id: user.id, full_name: user.full_name } : null };
  });
  res.json(result);
});

router.get('/my', authenticateToken, (req: AuthRequest, res: Response) => {
  const result = db.assignments
    .filter(a => a.assigned_user_id === req.user?.id)
    .map(a => {
      const customer = db.customers.find(c => c.id === a.customer_id);
      return { ...a, customer };
    });
  res.json(result);
});

router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { customer_id, assigned_user_id, title, description, scheduled_at } = req.body;
  if (!customer_id || !assigned_user_id || !title) {
    return res.status(400).json({ message: 'customer_id, assigned_user_id, and title are required' });
  }
  const assignment = {
    id: Date.now().toString(),
    customer_id,
    assigned_user_id,
    title,
    description: description || '',
    scheduled_at: scheduled_at || new Date().toISOString(),
    status: 'pending' as const,
    created_at: new Date().toISOString(),
  };
  db.assignments.push(assignment);
  addAudit('assignment', assignment.id, 'created', req.user!.id, `Assignment "${title}" created`);
  res.status(201).json(assignment);
});

router.patch('/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

  const { status } = req.body;
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  assignment.status = status;
  addAudit('assignment', assignment.id, 'status_updated', req.user!.id, `Status changed to ${status}`);
  res.json(assignment);
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const idx = db.assignments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Assignment not found' });
  db.assignments.splice(idx, 1);
  addAudit('assignment', req.params.id as string, 'deleted', req.user!.id, 'Assignment deleted');
  res.status(204).send();
});

export default router;
