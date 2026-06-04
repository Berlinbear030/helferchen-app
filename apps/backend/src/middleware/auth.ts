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

export const requireRole = (role: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
  next();
};
