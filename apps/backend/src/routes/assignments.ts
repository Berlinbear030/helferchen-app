import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';
import { AssignmentRepo, CustomerRepo, UserRepo } from '../db/queries';

const router = Router();

router.get('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const assignments = await AssignmentRepo.findAll();
  // Join customer and user info using Repos (which have fallbacks)
  const result = await Promise.all(assignments.map(async a => {
      const customer = await CustomerRepo.findById(a.customer_id);
      const user = await UserRepo.findById(a.assigned_user_id);
      return { ...a, customer, assigned_user: user ? { id: user.id, full_name: user.full_name } : null };
  }));
  res.json(result);
});

router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const assignments = await AssignmentRepo.findByUserId(userId);
  const result = await Promise.all(assignments.map(async a => {
      const customer = await CustomerRepo.findById(a.customer_id);
      return { ...a, customer };
  }));
  res.json(result);
});

router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  let { customer_id, assigned_user_id, title, description, scheduled_at, new_customer } = req.body;
  
  if (customer_id === 'NEW_CUSTOMER' && new_customer) {
    const names = new_customer.name.split(' ');
    const first = names[0];
    const last = names.slice(1).join(' ') || 'Unbekannt';
    const customer = await CustomerRepo.create(first, last, new_customer.address || '', new_customer.phone || '', '');
    customer_id = customer.id;
  }

  if (!customer_id || !title) {
    return res.status(400).json({ message: 'customer_id and title are required' });
  }
  const assignment = await AssignmentRepo.create(
    String(customer_id),
    assigned_user_id ? String(assigned_user_id) : null,
    String(title),
    String(description || ''),
    String(scheduled_at || new Date().toISOString())
  );
  res.status(201).json(assignment);
});

// GET /api/assignments/all — admin sees all assignments with customer + assigned user
router.get('/all', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const assignments = await AssignmentRepo.findAll();
  const result = await Promise.all(assignments.map(async a => {
    const customer = await CustomerRepo.findById(a.customer_id);
    const user = a.assigned_user_id ? await UserRepo.findById(a.assigned_user_id) : null;
    return { ...a, customer, assigned_user: user ? { id: user.id, full_name: user.full_name } : null };
  }));
  res.json(result);
});

// GET /api/assignments/map — returns mine (green) + unassigned (yellow) for map display
router.get('/map', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const [mine, unassigned] = await Promise.all([
    AssignmentRepo.findByUserId(userId),
    AssignmentRepo.findUnassigned(),
  ]);
  const withCustomer = async (a: any) => {
    const customer = await CustomerRepo.findById(a.customer_id);
    return { ...a, customer };
  };
  const [mineWithCustomer, unassignedWithCustomer] = await Promise.all([
    Promise.all(mine.map(withCustomer)),
    Promise.all(unassigned.map(withCustomer)),
  ]);
  res.json({ mine: mineWithCustomer, unassigned: unassignedWithCustomer });
});

// PATCH /api/assignments/:id — admin can reassign to a different employee
router.patch('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const assignment = await AssignmentRepo.findById(String(req.params.id));
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
  const { assigned_user_id, title, description, scheduled_at } = req.body;
  if (assigned_user_id !== undefined) {
    await AssignmentRepo.reassign(String(req.params.id), assigned_user_id || null);
  }
  res.json({ ...assignment, assigned_user_id: assigned_user_id ?? assignment.assigned_user_id });
});

router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const assignment = await AssignmentRepo.findById(String(req.params.id));
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

  const { status } = req.body;
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  await AssignmentRepo.updateStatus(String(req.params.id), String(status));
  res.json({ ...assignment, status });
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const success = await AssignmentRepo.delete(String(req.params.id));
  if (!success) return res.status(404).json({ message: 'Assignment not found' });
  res.status(204).send();
});

export default router;
