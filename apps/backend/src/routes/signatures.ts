import { Router, Response } from 'express';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/signatures — attach signature to a report, locks the timelog immutably
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { report_id, image_data, signer_name } = req.body;
  if (!report_id || !image_data || !signer_name) {
    return res.status(400).json({ message: 'report_id, image_data, and signer_name are required' });
  }

  const report = db.reports.find(r => r.id === report_id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (report.signature_id) return res.status(409).json({ message: 'Report is already signed — immutable' });

  const timelog = db.timelogs.find(t => t.id === report.timelog_id);
  if (!timelog) return res.status(404).json({ message: 'Timelog not found' });
  if (!timelog.end_time) return res.status(409).json({ message: 'Cannot sign a report with a running timer' });

  const signature = {
    id: Date.now().toString(),
    report_id,
    timelog_id: report.timelog_id,
    image_data,
    signed_at: new Date().toISOString(),
    signer_name,
  };
  db.signatures.push(signature);

  // Lock the timelog permanently
  timelog.is_signed = true;

  // Link signature to report
  report.signature_id = signature.id;

  addAudit('signature', signature.id, 'signed', req.user!.id, `Report ${report_id} signed by ${signer_name}`);
  addAudit('timelog', timelog.id, 'locked', req.user!.id, 'Timelog locked after signature');

  res.status(201).json(signature);
});

router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const sig = db.signatures.find(s => s.id === req.params.id);
  if (!sig) return res.status(404).json({ message: 'Not found' });
  res.json(sig);
});

export default router;
