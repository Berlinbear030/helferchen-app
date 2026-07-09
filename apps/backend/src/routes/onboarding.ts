import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepo, AuditRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

const MIN_AGE = 18;

function calcAge(birthDateStr: string): number {
  const birth = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// POST /api/onboarding/register — public self-registration for freelancers (EIS-506)
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, full_name, email, birth_date, address, criminal_record_upload } = req.body;

  if (!username || !password || !full_name || !birth_date || !criminal_record_upload) {
    return res.status(400).json({ message: 'username, password, full_name, birth_date und criminal_record_upload sind erforderlich' });
  }

  const birth = new Date(birth_date);
  if (isNaN(birth.getTime())) {
    return res.status(400).json({ message: 'birth_date ist ungültig' });
  }
  if (calcAge(birth_date) < MIN_AGE) {
    return res.status(403).json({ message: `Registrierung nicht möglich: Mindestalter ${MIN_AGE} Jahre.` });
  }
  if (typeof criminal_record_upload !== 'string' || !criminal_record_upload.startsWith('data:')) {
    return res.status(400).json({ message: 'Führungszeugnis muss als Datei-Upload (data URL) übermittelt werden' });
  }

  const existing = await UserRepo.findByUsername(username);
  if (existing) return res.status(409).json({ message: 'Benutzername bereits vergeben' });

  const password_hash = await bcrypt.hash(password, 10);
  const user = await UserRepo.createFreelancerRegistration({
    username, password_hash, full_name, email: email || '', birth_date, address, criminal_record_upload,
  });

  await AuditRepo.create('user', user.id, 'onboarding_submitted', user.id, `Registrierung eingereicht von ${full_name}`);
  res.status(201).json({ id: user.id, username: user.username, onboarding_status: 'pending_review' });
});

router.use(authenticateToken);

// GET /api/onboarding/pending — Prüf-Queue für Gebietsleiter/Admin
router.get('/pending', requireRole('admin', 'gebietsleiter'), async (_req: AuthRequest, res: Response) => {
  const list = await UserRepo.findPendingOnboarding();
  res.json(list);
});

// GET /api/onboarding/:id — full detail incl. Führungszeugnis, for review
router.get('/:id', requireRole('admin', 'gebietsleiter'), async (req: AuthRequest, res: Response) => {
  const entry = await UserRepo.findOnboardingDetail(req.params.id as string);
  if (!entry) return res.status(404).json({ message: 'Registrierung nicht gefunden' });
  res.json(entry);
});

// PATCH /api/onboarding/:id — approve/reject
router.patch('/:id', requireRole('admin', 'gebietsleiter'), async (req: AuthRequest, res: Response) => {
  const { status, review_note } = req.body;
  if (status !== 'active' && status !== 'rejected') {
    return res.status(400).json({ message: 'status muss "active" (Freigabe) oder "rejected" sein' });
  }

  const existing = await UserRepo.findOnboardingDetail(req.params.id as string);
  if (!existing) return res.status(404).json({ message: 'Registrierung nicht gefunden' });
  if (existing.onboarding_status !== 'pending_review') {
    return res.status(409).json({ message: 'Registrierung wurde bereits geprüft' });
  }

  const entry = await UserRepo.reviewOnboarding(req.params.id as string, {
    status, reviewed_by_user_id: req.user!.id, review_note: review_note || null,
  });

  await AuditRepo.create('user', req.params.id as string, `onboarding_${status}`, req.user!.id, review_note || '');
  res.json(entry);
});

export default router;
