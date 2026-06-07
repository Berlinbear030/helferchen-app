import { Router, Request, Response } from 'express';
import { BookingRequestRepo, AuditRepo } from '../db/queries';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Public: submit a booking request
router.post('/', async (req: Request, res: Response) => {
  const { name, phone, email, service_description, preferred_date, preferred_time } = req.body;
  if (!name || !phone || !service_description || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }
  const entry = await BookingRequestRepo.create({
    name,
    phone,
    email,
    service_description,
    preferred_date,
    preferred_time
  });
  return res.status(201).json(entry);
});

// Auth: list all booking requests
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const list = await BookingRequestRepo.findAll(status as string);
  return res.json(list);
});

// Auth: update status / assign
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { status, assigned_user_id, notes } = req.body;
  const entry = await BookingRequestRepo.update(req.params.id as string, { status, assigned_user_id, notes });
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden.' });
  
  await AuditRepo.create('booking_request', entry.id, 'update', req.user!.id, JSON.stringify({ status, assigned_user_id }));
  return res.json(entry);
});

export default router;
