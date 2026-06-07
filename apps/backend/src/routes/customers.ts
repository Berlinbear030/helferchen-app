import { Router, Response } from 'express';
import { CustomerRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const customers = await CustomerRepo.findAll();
  res.json(customers);
});

router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
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

export default router;
