import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { BookingRequestRepo, AuditRepo, CustomerRepo, AssignmentRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole, requirePermission } from '../middleware/auth';
import { sendBookingConfirmation, sendNewBookingAdminNotification } from '../services/email';
import { query } from '../db/pool';

const router = Router();

const bookingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Stunde erneut.' },
});

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Skip verification when not configured (dev mode)

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', ip);

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json() as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[booking] Turnstile verification error:', err);
    return false;
  }
}

// Public: submit a booking request
router.post('/', bookingRateLimit, async (req: Request, res: Response) => {
  const { name, phone, email, address, street, house_number, zip, city, service_description, preferred_date, preferred_time, turnstileToken } = req.body;

  // Require either the combined address or the split fields
  const hasAddress = address || (street && zip && city);
  if (!name || !phone || !hasAddress || !service_description || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }

  // Verify CAPTCHA token
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return res.status(400).json({ error: 'CAPTCHA-Verifizierung erforderlich.' });
    }
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const valid = await verifyTurnstile(turnstileToken, clientIp);
    if (!valid) {
      return res.status(400).json({ error: 'CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.' });
    }
  }

  const entry = await BookingRequestRepo.create({
    name,
    phone,
    email,
    address,
    street,
    house_number,
    zip,
    city,
    service_description,
    preferred_date,
    preferred_time,
  });

  // Send emails asynchronously (don't block response)
  const emailData = {
    name,
    email: email || '',
    phone,
    preferred_date,
    preferred_time,
    service_description,
    street,
    house_number,
    zip,
    city,
    address: entry.address,
  };
  if (email) {
    sendBookingConfirmation(emailData).catch((err) => {
      console.error('[booking] Confirmation email error:', err?.message || err);
    });
  }
  sendNewBookingAdminNotification(emailData).catch((err) => {
    console.error('[booking] Admin notification error:', err?.message || err);
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

  // If status changed to 'assigned' and we have a user, create/update the actual assignment
  if (status === 'assigned' && assigned_user_id) {
    let existingAssignment = await AssignmentRepo.findByBookingRequestId(entry.id);
    
    if (existingAssignment) {
      // Update existing assignment
      await AssignmentRepo.reassign(existingAssignment.id, assigned_user_id);
    } else {
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
        scheduledAt,
        entry.id
      );
    }
  }
  
  await AuditRepo.create('booking_request', entry.id, 'update', req.user!.id, JSON.stringify({ status, assigned_user_id }));
  return res.json(entry);
});

// Auth: delete a booking request (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    // Unlink assignments that reference this booking request before deleting
    await query('UPDATE assignments SET booking_request_id = NULL WHERE booking_request_id = ?', [id]);
    const success = await BookingRequestRepo.delete(id);
    if (!success) return res.status(404).json({ error: 'Nicht gefunden.' });
    await AuditRepo.create('booking_request', id, 'deleted', req.user!.id, 'Booking request deleted');
    return res.status(204).send();
  } catch (err: any) {
    console.error('DELETE /booking-requests error:', err);
    return res.status(500).json({ message: 'Fehler beim Löschen der Anfrage', detail: err.message });
  }
});

export default router;
