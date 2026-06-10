import { Router, Request, Response } from 'express';
import { BookingRequestRepo, AuditRepo, CustomerRepo, AssignmentRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public: submit a booking request
router.post('/', async (req: Request, res: Response) => {
  const { name, phone, email, address, service_description, preferred_date, preferred_time } = req.body;
  if (!name || !phone || !address || !service_description || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }
  const entry = await BookingRequestRepo.create({
    name,
    phone,
    email,
    address,
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
  const oldEntry = await BookingRequestRepo.findById(req.params.id as string);
  if (!oldEntry) return res.status(404).json({ error: 'Nicht gefunden.' });

  const entry = await BookingRequestRepo.update(req.params.id as string, { status, assigned_user_id, notes });
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden.' });

  // If status changed to 'assigned' and we have a user, create the actual assignment
  if (status === 'assigned' && assigned_user_id) {
    // 1. Create a Customer record (split name into first/last)
    const nameParts = entry.name.split(' ');
    const firstName = nameParts[0] || 'Kunde';
    const lastName = nameParts.slice(1).join(' ') || 'Unbekannt';
    
    const customer = await CustomerRepo.create(
      firstName,
      lastName,
      entry.address || 'Keine Adresse',
      entry.phone,
      `Erstellt aus Buchungsanfrage ${entry.id}`
    );

    // 2. Create the Assignment
    const scheduledAt = `${entry.preferred_date}T${entry.preferred_time}:00`;
    await AssignmentRepo.create(
      customer.id,
      assigned_user_id,
      `Service: ${entry.service_description.slice(0, 30)}...`,
      entry.service_description,
      scheduledAt
    );
  }
  
  await AuditRepo.create('booking_request', entry.id, 'update', req.user!.id, JSON.stringify({ status, assigned_user_id }));
  return res.json(entry);
});

export default router;
