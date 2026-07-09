import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { query } from '../db/pool';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/promoters — admin + kundenbetreuer (need it to look up codes at order intake)
router.get('/', authenticateToken, requireRole('admin', 'kundenbetreuer'), async (_req: AuthRequest, res: Response) => {
  const result = await query('SELECT * FROM promoters ORDER BY created_at DESC');
  res.json(result.rows);
});

// POST /api/promoters — admin only
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ message: 'code und name sind erforderlich' });
  const id = randomUUID();
  try {
    await query('INSERT INTO promoters (id, code, name) VALUES (?, ?, ?)', [id, String(code).trim(), String(name)]);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Promoter-Code existiert bereits' });
    throw err;
  }
  const result = await query('SELECT * FROM promoters WHERE id = ?', [id]);
  res.status(201).json(result.rows[0]);
});

// PATCH /api/promoters/:id — admin only (rename / activate / deactivate)
router.patch('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { name, active } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (active !== undefined) { updates.push('active = ?'); values.push(!!active); }
  if (updates.length === 0) return res.status(400).json({ message: 'Keine Felder zum Aktualisieren' });
  values.push(req.params.id);
  await query(`UPDATE promoters SET ${updates.join(', ')} WHERE id = ?`, values);
  const result = await query('SELECT * FROM promoters WHERE id = ?', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Promoter nicht gefunden' });
  res.json(result.rows[0]);
});

export default router;
