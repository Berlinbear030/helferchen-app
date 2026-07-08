import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepo } from '../db/queries';
import { addAudit } from '../db';
import { query } from '../db/pool';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await UserRepo.findByUsername(username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const permissions: string[] = (() => { try { return JSON.parse(user.permissions || '[]'); } catch { return []; } })();
  const payload = { id: user.id, username: user.username, role: user.role, permissions };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
  // Update last_seen on login
  await query('UPDATE users SET last_seen = NOW() WHERE id = ?', [user.id]).catch(() => {});
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, permissions } });
});

// POST /api/auth/heartbeat — update last_seen to keep user "online"
router.post('/heartbeat', authenticateToken, async (req: AuthRequest, res: Response) => {
  await query('UPDATE users SET last_seen = NOW() WHERE id = ?', [req.user!.id]).catch(() => {});
  return res.json({ ok: true });
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await UserRepo.findById(req.user?.id || '');
  if (!user) return res.status(404).json({ message: 'User not found' });
  const permissions: string[] = (() => { try { return JSON.parse(user.permissions || '[]'); } catch { return []; } })();
  res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email, permissions });
});

export default router;
