import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole, requirePermission } from '../middleware/auth';
import { ReportRepo, TimelogRepo, AssignmentRepo } from '../db/queries';

const router = Router();

// Create a report for a completed timelog
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { assignment_id, timelog_id, notes } = req.body;
  if (!assignment_id || !timelog_id) {
    return res.status(400).json({ message: 'assignment_id and timelog_id are required' });
  }

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

// GET /api/reports/customer-stats — revenue aggregation per customer (admin)
router.get('/customer-stats', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  function calcPrice(minutes: number): number {
    if (minutes <= 15) return 20;
    return 20 + Math.ceil((minutes - 15) / 15) * 15;
  }

  const reports = await ReportRepo.findAll();
  const statsMap: Record<string, { total_revenue: number; open_amount: number }> = {};

  await Promise.all(reports.map(async (report) => {
    const [timelog, assignment] = await Promise.all([
      TimelogRepo.findById(report.timelog_id),
      AssignmentRepo.findById(report.assignment_id),
    ]);
    if (!assignment) return;

    const minutes = (timelog?.start_time && timelog?.end_time)
      ? Math.max(0, Math.round(
          (new Date(String(timelog.end_time).replace(' ', 'T') + (String(timelog.end_time).includes('Z') ? '' : 'Z')).getTime() -
           new Date(String(timelog.start_time).replace(' ', 'T') + (String(timelog.start_time).includes('Z') ? '' : 'Z')).getTime()) / 60000
        ))
      : 0;
    const price = calcPrice(minutes);
    const customerId = assignment.customer_id;

    if (!statsMap[customerId]) statsMap[customerId] = { total_revenue: 0, open_amount: 0 };
    statsMap[customerId].total_revenue += price;
    if (!report.signature_id) statsMap[customerId].open_amount += price;
  }));

  res.json(statsMap);
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const report = await ReportRepo.findById(String(req.params.id));
  if (!report) return res.status(404).json({ message: 'Not found' });
  res.json(report);
});

router.delete('/:id', authenticateToken, requirePermission('Auftrag loeschen'), async (req: AuthRequest, res: Response) => {
  const success = await ReportRepo.delete(String(req.params.id));
  if (!success) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
});

export default router;
