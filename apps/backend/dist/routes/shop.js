"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
const SHOP_EMAIL = process.env.SHOP_EMAIL || 'shop@helferchen.info';
// Public: list active articles
router.get('/articles', async (_req, res) => {
    const articles = await queries_1.ShopArticleRepo.findAll(true);
    res.json(articles);
});
// Public: place an order
router.post('/order', async (req, res) => {
    const { customerName, customerEmail, items } = req.body;
    if (!customerName || !customerEmail || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
    }
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    (0, email_1.sendShopOrderEmail)({ customerName, customerEmail, items, total, shopEmail: SHOP_EMAIL }).catch(() => { });
    return res.status(201).json({ success: true });
});
// Auth (admin): list all articles
router.get('/admin/articles', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    const articles = await queries_1.ShopArticleRepo.findAll(false);
    res.json(articles);
});
// Auth (admin): create article
router.post('/admin/articles', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const { name, description, price, image_url, stock } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name und price sind Pflichtfelder.' });
    }
    const article = await queries_1.ShopArticleRepo.create({
        name: String(name),
        description: String(description || ''),
        price: parseFloat(price),
        image_url: String(image_url || ''),
        stock: parseInt(stock) || 0,
    });
    res.status(201).json(article);
});
// Auth (admin): update article
router.patch('/admin/articles/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const { name, description, price, image_url, stock, active } = req.body;
    const id = String(req.params.id);
    const ok = await queries_1.ShopArticleRepo.update(id, {
        ...(name !== undefined && { name: String(name) }),
        ...(description !== undefined && { description: String(description) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(image_url !== undefined && { image_url: String(image_url) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(active !== undefined && { active: Boolean(active) }),
    });
    if (!ok)
        return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    const article = await queries_1.ShopArticleRepo.findById(id);
    res.json(article);
});
// Auth (admin): delete article
router.delete('/admin/articles/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const ok = await queries_1.ShopArticleRepo.delete(String(req.params.id));
    if (!ok)
        return res.status(404).json({ error: 'Artikel nicht gefunden.' });
    res.status(204).send();
});
exports.default = router;
