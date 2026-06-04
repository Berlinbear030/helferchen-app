import { Router, Response } from 'express';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Create a report for a completed timelog
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { assignment_id, timelog_id, notes } = req.body;
  if (!assignment_id || !timelog_id) {
    return res.status(400).json({ message: 'assignment_id and timelog_id are required' });
  }

  const timelog = db.timelogs.find(t => t.id === timelog_id);
  if (!timelog) return res.status(404).json({ message: 'Timelog not found' });
  if (!timelog.end_time) return res.status(409).json({ message: 'Cannot create report for a running timer' });

  const existing = db.reports.find(r => r.timelog_id === timelog_id);
  if (existing) return res.status(409).json({ message: 'Report already exists for this timelog' });

  const report = {
    id: Date.now().toString(),
    assignment_id,
    timelog_id,
    created_by_user_id: req.user!.id,
    notes: notes || '',
    signature_id: null as string | null,
    pdf_generated: false,
    email_sent: false,
    created_at: new Date().toISOString(),
  };
  db.reports.push(report);
  addAudit('report', report.id, 'created', req.user!.id, `Report created for timelog ${timelog_id}`);
  res.status(201).json(report);
});

router.get('/my', authenticateToken, (req: AuthRequest, res: Response) => {
  const reports = db.reports
    .filter(r => r.created_by_user_id === req.user?.id)
    .map(r => enrichReport(r));
  res.json(reports);
});

router.get('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  res.json(db.reports.map(r => enrichReport(r)));
});

router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ message: 'Not found' });
  res.json(enrichReport(report));
});

function enrichReport(report: typeof db.reports[number]) {
  const timelog = db.timelogs.find(t => t.id === report.timelog_id);
  const assignment = db.assignments.find(a => a.id === report.assignment_id);
  const customer = assignment ? db.customers.find(c => c.id === assignment.customer_id) : null;
  const signature = report.signature_id ? db.signatures.find(s => s.id === report.signature_id) : null;
  return { ...report, timelog, assignment, customer, signature };
}

export default router;
