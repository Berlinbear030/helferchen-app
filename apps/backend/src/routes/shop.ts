import { Router, Request, Response } from 'express';
import { ShopArticleRepo } from '../db/queries';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';
import { sendShopOrderEmail } from '../services/email';

const router = Router();

const SHOP_EMAIL = process.env.SHOP_EMAIL || 'shop@helferchen.info';

// Public: list active articles
router.get('/articles', async (_req: Request, res: Response) => {
  const articles = await ShopArticleRepo.findAll(true);
  res.json(articles);
});

// Public: place an order
router.post('/order', async (req: Request, res: Response) => {
  const { customerName, customerEmail, items } = req.body;
  if (!customerName || !customerEmail || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }

  const total = items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);

  sendShopOrderEmail({ customerName, customerEmail, items, total, shopEmail: SHOP_EMAIL }).catch(() => {});

  return res.status(201).json({ success: true });
});

// Auth (admin): list all articles
router.get('/admin/articles', authenticateToken, requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const articles = await ShopArticleRepo.findAll(false);
  res.json(articles);
});

// Auth (admin): create article
router.post('/admin/articles', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { name, description, price, image_url, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name und price sind Pflichtfelder.' });
  }
  const article = await ShopArticleRepo.create({
    name: String(name),
    description: String(description || ''),
    price: parseFloat(price),
    image_url: String(image_url || ''),
    stock: parseInt(stock) || 0,
  });
  res.status(201).json(article);
});

// Auth (admin): update article
router.patch('/admin/articles/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { name, description, price, image_url, stock, active } = req.body;
  const id = String(req.params.id);
  const ok = await ShopArticleRepo.update(id, {
    ...(name !== undefined && { name: String(name) }),
    ...(description !== undefined && { description: String(description) }),
    ...(price !== undefined && { price: parseFloat(price) }),
    ...(image_url !== undefined && { image_url: String(image_url) }),
    ...(stock !== undefined && { stock: parseInt(stock) }),
    ...(active !== undefined && { active: Boolean(active) }),
  });
  if (!ok) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  const article = await ShopArticleRepo.findById(id);
  res.json(article);
});

// Auth (admin): delete article
router.delete('/admin/articles/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const ok = await ShopArticleRepo.delete(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  res.status(204).send();
});

export default router;
