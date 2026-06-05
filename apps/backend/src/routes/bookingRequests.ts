import { Router, Request, Response } from 'express';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Public: submit a booking request
router.post('/', (req: Request, res: Response) => {
  const { name, phone, email, service_description, preferred_date, preferred_time } = req.body;
  if (!name || !phone || !service_description || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }
  const entry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name,
    phone,
    email: email || '',
    service_description,
    preferred_date,
    preferred_time,
    status: 'open' as const,
    assigned_user_id: null,
    notes: '',
    created_at: new Date().toISOString(),
  };
  db.bookingRequests.push(entry);
  return res.status(201).json(entry);
});

// Auth: list all booking requests
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  let list = [...db.bookingRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (status) list = list.filter(r => r.status === status);
  return res.json(list);
});

// Auth: update status / assign
router.patch('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const entry = db.bookingRequests.find(r => r.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden.' });
  const { status, assigned_user_id, notes } = req.body;
  if (status) entry.status = status;
  if (assigned_user_id !== undefined) entry.assigned_user_id = assigned_user_id;
  if (notes !== undefined) entry.notes = notes;
  addAudit('booking_request', entry.id, 'update', req.user!.id, JSON.stringify({ status, assigned_user_id }));
  return res.json(entry);
});

export default router;
