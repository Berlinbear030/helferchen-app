import { Router, Response } from 'express';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(db.customers);
});

router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { first_name, last_name, address, phone_number, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ message: 'first_name and last_name are required' });

  const customer = {
    id: Date.now().toString(),
    first_name,
    last_name,
    address: address || '',
    phone_number: phone_number || '',
    notes: notes || '',
    created_at: new Date().toISOString(),
  };
  db.customers.push(customer);
  addAudit('customer', customer.id, 'created', req.user!.id, `Customer ${first_name} ${last_name} created`);
  res.status(201).json(customer);
});

export default router;
