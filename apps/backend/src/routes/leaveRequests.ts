import { Router, Response } from 'express';
import { LeaveRequestRepo, AuditRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

const VALID_TYPES = ['urlaub', 'krankmeldung'];

router.use(authenticateToken);

// GET /api/leave-requests/my — own requests, any authenticated user
router.get('/my', async (req: AuthRequest, res: Response) => {
  const list = await LeaveRequestRepo.findByUserId(req.user!.id);
  res.json(list);
});

// GET /api/leave-requests — all requests, admin only
router.get('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const list = await LeaveRequestRepo.findAll(status as string | undefined);
  res.json(list);
});

// POST /api/leave-requests — submit a leave/sick-leave request
router.post('/', async (req: AuthRequest, res: Response) => {
  const { type, start_date, end_date, reason } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: 'type muss "urlaub" oder "krankmeldung" sein' });
  }
  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'start_date und end_date sind erforderlich' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ message: 'end_date darf nicht vor start_date liegen' });
  }

  const entry = await LeaveRequestRepo.create({
    user_id: req.user!.id,
    type,
    start_date,
    end_date,
    reason: reason || null,
  });

  await AuditRepo.create('leave_request', entry.id, 'created', req.user!.id, `${type} beantragt: ${start_date} bis ${end_date}`);
  res.status(201).json(entry);
});

// PATCH /api/leave-requests/:id — approve/reject, admin only
router.patch('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { status, review_note } = req.body;
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ message: 'status muss "approved" oder "rejected" sein' });
  }

  const existing = await LeaveRequestRepo.findById(req.params.id as string);
  if (!existing) return res.status(404).json({ message: 'Antrag nicht gefunden' });

  const entry = await LeaveRequestRepo.updateStatus(req.params.id as string, {
    status,
    reviewed_by_user_id: req.user!.id,
    review_note: review_note || null,
  });

  await AuditRepo.create('leave_request', req.params.id as string, status, req.user!.id, review_note || '');
  res.json(entry);
});

export default router;
