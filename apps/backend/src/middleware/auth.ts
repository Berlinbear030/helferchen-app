import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET as string || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user as AuthRequest['user'];
    next();
  });
};

// Role hierarchy: admin > gebietsleiter > kundenbetreuer|buchhaltung > mitarbeiter
export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  gebietsleiter: 70,
  kundenbetreuer: 50,
  buchhaltung: 50,
  mitarbeiter: 10,
  employee: 10,
};

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(403).json({ message: 'Forbidden' });
  if (roles.includes(req.user.role)) return next();
  // admin always has access
  if (req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Forbidden' });
};
