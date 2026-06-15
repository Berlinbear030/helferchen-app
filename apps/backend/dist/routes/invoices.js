"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const crypto_1 = require("crypto");
const auth_1 = require("../middleware/auth");
const authenticate = auth_1.authenticateToken;
const requireAdmin = (0, auth_1.requireRole)('admin');
const router = (0, express_1.Router)();
// GET /api/invoices — list all reports as invoices with related data
router.get('/', authenticate, requireAdmin, async (_req, res) => {
    try {
        const result = await (0, pool_1.query)(`
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
        r.voucher_code,
        r.voucher_label,
        r.voucher_discount_amount,
        r.payment_method,
        r.payment_due_days,
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// PATCH /api/invoices/:id — update invoice fields
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { invoice_number, invoice_notes, invoice_amount_override, payment_method, payment_due_days } = req.body;
    try {
        const sets = [];
        const vals = [];
        if (invoice_number !== undefined) {
            sets.push('invoice_number = ?');
            vals.push(invoice_number);
        }
        if (invoice_notes !== undefined) {
            sets.push('invoice_notes = ?');
            vals.push(invoice_notes);
        }
        if (invoice_amount_override !== undefined) {
            sets.push('invoice_amount_override = ?');
            vals.push(invoice_amount_override);
        }
        if (payment_method !== undefined) {
            sets.push('payment_method = ?');
            vals.push(payment_method);
        }
        if (payment_due_days !== undefined) {
            sets.push('payment_due_days = ?');
            vals.push(payment_due_days);
        }
        if (sets.length === 0)
            return res.status(400).json({ message: 'No fields to update' });
        vals.push(id);
        await (0, pool_1.query)(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?`, vals);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// GET /api/invoices/:id/items — get line items for a report/invoice
router.get('/:id/items', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await (0, pool_1.query)('SELECT * FROM invoice_items WHERE report_id = ? ORDER BY position ASC, created_at ASC', [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// POST /api/invoices/:id/items — add a line item
router.post('/:id/items', authenticate, requireAdmin, async (req, res) => {
    const { description, quantity, unit_price, position } = req.body;
    try {
        const id = (0, crypto_1.randomUUID)();
        await (0, pool_1.query)('INSERT INTO invoice_items (id, report_id, position, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)', [id, req.params.id, position ?? 1, description ?? '', quantity ?? 1, unit_price ?? 0]);
        const result = await (0, pool_1.query)('SELECT * FROM invoice_items WHERE id = ?', [id]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// PATCH /api/invoice-items/:id — update a single line item
router.patch('/items/:itemId', authenticate, requireAdmin, async (req, res) => {
    const { description, quantity, unit_price, position } = req.body;
    try {
        const sets = [];
        const vals = [];
        if (description !== undefined) {
            sets.push('description = ?');
            vals.push(description);
        }
        if (quantity !== undefined) {
            sets.push('quantity = ?');
            vals.push(quantity);
        }
        if (unit_price !== undefined) {
            sets.push('unit_price = ?');
            vals.push(unit_price);
        }
        if (position !== undefined) {
            sets.push('position = ?');
            vals.push(position);
        }
        if (sets.length === 0)
            return res.status(400).json({ message: 'No fields' });
        vals.push(req.params.itemId);
        await (0, pool_1.query)(`UPDATE invoice_items SET ${sets.join(', ')} WHERE id = ?`, vals);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// DELETE /api/invoice-items/:id — delete a line item
router.delete('/items/:itemId', authenticate, requireAdmin, async (req, res) => {
    try {
        await (0, pool_1.query)('DELETE FROM invoice_items WHERE id = ?', [req.params.itemId]);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
