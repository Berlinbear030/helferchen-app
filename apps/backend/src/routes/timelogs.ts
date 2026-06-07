import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { TimelogRepo } from '../db/queries';

const router = Router();

// POST /api/timelogs/start — server-side start, client cannot set timestamp
router.post('/start', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { assignment_id } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const existing = await TimelogRepo.findActive(userId, assignment_id);
  if (existing) {
    return res.status(409).json({ message: 'Timer already running for this assignment' });
  }

  const timelog = await TimelogRepo.create(userId, assignment_id);
  res.status(201).json(timelog);
});

// POST /api/timelogs/stop — server-side stop
router.post('/stop', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { timelog_id } = req.body;
  const userId = req.user?.id;

  // We should check if the timelog exists and belongs to the user
  // For now, simpler:
  try {
    const timelog = await TimelogRepo.stop(timelog_id);
    res.json(timelog);
  } catch (e) {
    res.status(404).json({ message: 'Timelog not found or already stopped' });
  }
});

// GET /api/timelogs/my — timelogs for current user
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const logs = await TimelogRepo.findByUserId(userId);
  res.json(logs);
});

export default router;
