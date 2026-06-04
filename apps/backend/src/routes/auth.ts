import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const payload = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
  addAudit('user', user.id, 'login', user.id, 'User logged in');
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const user = db.users.find(u => u.id === req.user?.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email });
});

export default router;
