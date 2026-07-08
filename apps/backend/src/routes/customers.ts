import { Router, Response } from 'express';
import { CustomerRepo, AuditRepo } from '../db/queries';
import { query } from '../db/pool';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const customers = await CustomerRepo.findAll();
  res.json(customers);
});

router.post('/', authenticateToken, requireRole('admin', 'kundenbetreuer'), async (req: AuthRequest, res: Response) => {
  const { first_name, last_name, address, phone_number, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ message: 'first_name and last_name are required' });

  const customer = await CustomerRepo.create(
    String(first_name),
    String(last_name),
    String(address || ''),
    String(phone_number || ''),
    String(notes || '')
  );
  // addAudit('customer', customer.id, 'created', req.user!.id, `Customer ${first_name} ${last_name} created`);
  res.status(201).json(customer);
});

// PATCH /customers/:id — edit customer data (admin only)
router.patch('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const customer = await CustomerRepo.findById(id);
  if (!customer) return res.status(404).json({ error: 'Nicht gefunden.' });
  const { first_name, last_name, address, phone_number, notes } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
  if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address); }
  if (phone_number !== undefined) { updates.push('phone_number = ?'); values.push(phone_number); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
  if (updates.length === 0) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren.' });
  values.push(id);
  await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);
  const updated = await CustomerRepo.findById(id);
  return res.json(updated);
});

// DELETE /customers/:id — DSGVO: cascading hard delete (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const customer = await CustomerRepo.findById(id);
    if (!customer) return res.status(404).json({ error: 'Nicht gefunden.' });

    // Cascade: get assignment IDs for this customer
    const assignRes = await query('SELECT id FROM assignments WHERE customer_id = ?', [id]);
    const assignmentIds: string[] = assignRes.rows.map((a: any) => a.id);

    for (const aid of assignmentIds) {
      // Delete signatures first (FK: signatures.timelog_id -> time_logs.id)
      await query(
        'DELETE FROM signatures WHERE timelog_id IN (SELECT id FROM time_logs WHERE assignment_id = ?)',
        [aid]
      );
      await query('DELETE FROM reports WHERE assignment_id = ?', [aid]);
      await query('DELETE FROM time_logs WHERE assignment_id = ?', [aid]);
    }

    // Unlink booking_requests that reference these assignments
    if (assignmentIds.length > 0) {
      const placeholders = assignmentIds.map(() => '?').join(',');
      await query(
        `UPDATE booking_requests SET assigned_user_id = NULL WHERE assigned_user_id IN (
           SELECT assigned_user_id FROM assignments WHERE id IN (${placeholders})
         )`,
        assignmentIds
      );
    }

    await query('DELETE FROM assignments WHERE customer_id = ?', [id]);

    const success = await CustomerRepo.delete(id);
    if (!success) return res.status(404).json({ error: 'Nicht gefunden.' });

    await AuditRepo.create('customer', id, 'deleted', req.user!.id, `Kunde gelöscht (DSGVO): ${customer.first_name} ${customer.last_name}`);
    return res.status(204).send();
  } catch (err: any) {
    console.error('DELETE /customers error:', err);
    return res.status(500).json({ message: 'Fehler beim Löschen des Kunden', detail: err.message });
  }
});

export default router;
