import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { SignatureRepo, ReportRepo, TimelogRepo } from '../db/queries';
import { query } from '../db/pool';

const router = Router();

// POST /api/signatures — attach signature to a report, locks the timelog immutably
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { report_id, image_data, signer_name } = req.body;
  if (!report_id || !image_data || !signer_name) {
    return res.status(400).json({ message: 'report_id, image_data, and signer_name are required' });
  }

  const report = await ReportRepo.findById(report_id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (report.signature_id) return res.status(409).json({ message: 'Report is already signed — immutable' });

  const timelogRes = await query('SELECT end_time FROM time_logs WHERE id = $1', [report.timelog_id]);
  const timelog = timelogRes.rows[0];
  
  if (!timelog) return res.status(404).json({ message: 'Timelog not found' });
  if (!timelog.end_time) return res.status(409).json({ message: 'Cannot sign a report with a running timer' });

  const signature = await SignatureRepo.create(report.timelog_id, image_data, signer_name);

  // Lock the timelog permanently
  await TimelogRepo.updateSignedStatus(report.timelog_id, true);

  // Link signature to report
  await ReportRepo.updateSignature(report_id, signature.id);

  res.status(201).json(signature);
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const res_db = await query('SELECT * FROM signatures WHERE id = $1', [req.params.id]);
  const sig = res_db.rows[0];
  if (!sig) return res.status(404).json({ message: 'Not found' });
  res.json(sig);
});

export default router;
