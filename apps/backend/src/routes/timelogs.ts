import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import db from '../db';

const router = Router();

// POST /api/timelogs/start — server-side start, client cannot set timestamp
router.post('/start', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { assignment_id } = req.body;
  const userId = req.user?.id;

  const existing = db.timelogs.find(
    t => t.user_id === userId && t.assignment_id === assignment_id && !t.end_time
  );
  if (existing) {
    return res.status(409).json({ message: 'Timer already running for this assignment' });
  }

  const timelog = {
    id: Date.now().toString(),
    user_id: userId!,
    assignment_id,
    start_time: new Date().toISOString(), // server-side immutable
    end_time: null as string | null,
    is_signed: false,
    created_at: new Date().toISOString(),
  };
  db.timelogs.push(timelog);
  res.status(201).json(timelog);
});

// POST /api/timelogs/stop — server-side stop
router.post('/stop', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { timelog_id } = req.body;
  const userId = req.user?.id;

  const timelog = db.timelogs.find(t => t.id === timelog_id && t.user_id === userId);
  if (!timelog) return res.status(404).json({ message: 'Timelog not found' });
  if (timelog.end_time) return res.status(409).json({ message: 'Timer already stopped' });
  if (timelog.is_signed) return res.status(403).json({ message: 'Timelog is immutable after signing' });

  timelog.end_time = new Date().toISOString(); // server-side immutable
  res.json(timelog);
});

// GET /api/timelogs/my — timelogs for current user
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const logs = db.timelogs.filter(t => t.user_id === req.user?.id);
  res.json(logs);
});

// GET /api/timelogs/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const timelog = db.timelogs.find(t => t.id === req.params.id);
  if (!timelog) return res.status(404).json({ message: 'Not found' });
  res.json(timelog);
});

export default router;
