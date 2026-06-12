import { Router } from 'express';
import { query } from '../db/pool';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole } from '../middleware/auth';

const authenticate = authenticateToken;
const requireAdmin = requireRole('admin');

const router = Router();

// GET /api/invoices — list all reports as invoices with related data
router.get('/', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        r.id,
        r.assignment_id,
        r.timelog_id,
        r.created_by_user_id,
        r.notes,
        r.signature_id,
        r.pdf_generated,
        r.email_sent,
        r.invoice_number,
        r.invoice_notes,
        r.invoice_amount_override,
        r.created_at,
        tl.start_time,
        tl.end_time,
        tl.duration_minutes,
        tl.total_price,
        tl.blocks_count,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.address AS customer_address,
        u.full_name AS employee_name,
        a.title AS assignment_title
      FROM reports r
      LEFT JOIN time_logs tl ON tl.id = r.timelog_id
      LEFT JOIN assignments a ON a.id = r.assignment_id
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN users u ON u.id = r.created_by_user_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/invoices/:id — update invoice fields
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { invoice_number, invoice_notes, invoice_amount_override } = req.body;
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (invoice_number !== undefined) { sets.push('invoice_number = ?'); vals.push(invoice_number); }
    if (invoice_notes !== undefined) { sets.push('invoice_notes = ?'); vals.push(invoice_notes); }
    if (invoice_amount_override !== undefined) { sets.push('invoice_amount_override = ?'); vals.push(invoice_amount_override); }
    if (sets.length === 0) return res.status(400).json({ message: 'No fields to update' });
    vals.push(id);
    await query(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices/:id/items — get line items for a report/invoice
router.get('/:id/items', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM invoice_items WHERE report_id = ? ORDER BY position ASC, created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/invoices/:id/items — add a line item
router.post('/:id/items', authenticate, requireAdmin, async (req, res) => {
  const { description, quantity, unit_price, position } = req.body;
  try {
    const id = randomUUID();
    await query(
      'INSERT INTO invoice_items (id, report_id, position, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.id, position ?? 1, description ?? '', quantity ?? 1, unit_price ?? 0]
    );
    const result = await query('SELECT * FROM invoice_items WHERE id = ?', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/invoice-items/:id — update a single line item
router.patch('/items/:itemId', authenticate, requireAdmin, async (req, res) => {
  const { description, quantity, unit_price, position } = req.body;
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (quantity !== undefined) { sets.push('quantity = ?'); vals.push(quantity); }
    if (unit_price !== undefined) { sets.push('unit_price = ?'); vals.push(unit_price); }
    if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
    if (sets.length === 0) return res.status(400).json({ message: 'No fields' });
    vals.push(req.params.itemId);
    await query(`UPDATE invoice_items SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/invoice-items/:id — delete a line item
router.delete('/items/:itemId', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM invoice_items WHERE id = ?', [req.params.itemId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
