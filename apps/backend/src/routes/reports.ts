import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';
import { ReportRepo } from '../db/queries';

const router = Router();

// Create a report for a completed timelog
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { assignment_id, timelog_id, notes } = req.body;
  if (!assignment_id || !timelog_id) {
    return res.status(400).json({ message: 'assignment_id and timelog_id are required' });
  }

  const { TimelogRepo } = await import('../db/queries');

  // Check if timelog exists and is stopped
  const timelog = await TimelogRepo.findById(String(timelog_id));
  
  if (!timelog) return res.status(404).json({ message: 'Timelog not found' });
  if (!timelog.end_time) return res.status(409).json({ message: 'Cannot create report for a running timer' });

  // Check if report already exists
  const existing = await ReportRepo.findByTimelogId(String(timelog_id));
  if (existing) return res.status(409).json({ message: 'Report already exists for this timelog' });

  const report = await ReportRepo.create(
    String(assignment_id),
    String(timelog_id),
    req.user!.id,
    String(notes || '')
  );
  
  // addAudit('report', report.id, 'created', req.user!.id, `Report created for timelog ${timelog_id}`);
  res.status(201).json(report);
});

router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const reports = await ReportRepo.findByUserId(userId);
  res.json(reports);
});

router.get('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const reports = await ReportRepo.findAll();
  res.json(reports);
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const report = await ReportRepo.findById(String(req.params.id));
  if (!report) return res.status(404).json({ message: 'Not found' });
  res.json(report);
});

export default router;
