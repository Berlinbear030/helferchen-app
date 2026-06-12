import { Router } from 'express';
import { query } from '../db/pool';
import { randomUUID } from 'crypto';
import { authenticateToken, requireRole } from '../middleware/auth';

const authenticate = authenticateToken;
const requireAdmin = requireRole('admin');

const router = Router();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `HELF-${seg()}-${seg()}`;
}

// GET /api/vouchers — list all vouchers with usage
router.get('/', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT v.*, COUNT(vu.id) AS actual_uses
      FROM vouchers v
      LEFT JOIN voucher_usages vu ON vu.voucher_id = v.id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/vouchers/export — CSV download (?available=1 for unused only)
router.get('/export', authenticate, requireAdmin, async (req, res) => {
  const onlyAvailable = req.query.available === '1';
  try {
    const sql = onlyAvailable
      ? `SELECT * FROM vouchers WHERE active = TRUE AND used_count = 0 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC`
      : `SELECT * FROM vouchers ORDER BY created_at DESC`;
    const result = await query(sql);
    const rows = result.rows as any[];
    const lines = [
      'Code,Label,Rabatttyp,Rabattwert,Max.Nutzungen,Genutzt,Aktiv,Läuft ab,Erstellt',
      ...rows.map(r => [
        r.code,
        `"${(r.label || '').replace(/"/g, '""')}"`,
        r.discount_type === 'percent' ? 'Prozent' : 'Festbetrag',
        r.discount_value,
        r.max_uses ?? 'unbegrenzt',
        r.used_count,
        r.active ? 'ja' : 'nein',
        r.expires_at ? new Date(r.expires_at).toLocaleDateString('de-DE') : '',
        new Date(r.created_at).toLocaleDateString('de-DE'),
      ].join(','))
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${onlyAvailable ? 'gutscheine-verfuegbar' : 'gutscheine-alle'}.csv"`);
    res.send('﻿' + lines.join('\r\n'));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/vouchers/generate — create one or many vouchers
router.post('/generate', authenticate, requireAdmin, async (req, res) => {
  const { label, discount_type, discount_value, max_uses, expires_at, notes, count = 1 } = req.body;
  if (!label || !discount_type || discount_value == null) {
    return res.status(400).json({ message: 'label, discount_type und discount_value sind erforderlich' });
  }
  if (!['percent', 'fixed'].includes(discount_type)) {
    return res.status(400).json({ message: 'discount_type muss "percent" oder "fixed" sein' });
  }
  const n = Math.min(Math.max(1, parseInt(count) || 1), 500);
  try {
    const created = [];
    for (let i = 0; i < n; i++) {
      let code = generateCode();
      // ensure uniqueness by retrying on collision
      for (let attempt = 0; attempt < 5; attempt++) {
        const exists = await query('SELECT id FROM vouchers WHERE code = ?', [code]);
        if (exists.rows.length === 0) break;
        code = generateCode();
      }
      const id = randomUUID();
      await query(
        `INSERT INTO vouchers (id, code, label, discount_type, discount_value, max_uses, expires_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, code, label, discount_type, discount_value, max_uses || null, expires_at || null, notes || null]
      );
      created.push(code);
    }
    res.status(201).json({ created: created.length, codes: created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/vouchers/validate — check if code is valid and return discount
router.post('/validate', authenticate, async (req, res) => {
  const { code, gross_amount } = req.body;
  if (!code) return res.status(400).json({ message: 'code ist erforderlich' });
  try {
    const result = await query('SELECT * FROM vouchers WHERE code = ? AND active = TRUE', [code.toUpperCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Gutscheincode nicht gefunden oder deaktiviert' });
    }
    const v = result.rows[0] as any;
    if (v.expires_at && new Date(v.expires_at) < new Date()) {
      return res.status(400).json({ valid: false, message: 'Gutscheincode ist abgelaufen' });
    }
    if (v.max_uses != null && v.used_count >= v.max_uses) {
      return res.status(400).json({ valid: false, message: 'Gutscheincode wurde bereits vollständig eingelöst' });
    }
    let discount_amount = 0;
    if (gross_amount != null) {
      const amount = parseFloat(gross_amount) || 0;
      discount_amount = v.discount_type === 'percent'
        ? Math.round(amount * v.discount_value / 100 * 100) / 100
        : Math.min(parseFloat(v.discount_value), amount);
    }
    res.json({ valid: true, voucher: v, discount_amount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/vouchers/apply — apply voucher to a report
router.post('/apply', authenticate, async (req, res) => {
  const { code, report_id, gross_amount } = req.body;
  if (!code || !report_id) return res.status(400).json({ message: 'code und report_id sind erforderlich' });
  try {
    const vResult = await query('SELECT * FROM vouchers WHERE code = ? AND active = TRUE', [code.toUpperCase().trim()]);
    if (vResult.rows.length === 0) {
      return res.status(404).json({ message: 'Gutscheincode nicht gefunden oder deaktiviert' });
    }
    const v = vResult.rows[0] as any;
    if (v.expires_at && new Date(v.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Gutscheincode ist abgelaufen' });
    }
    if (v.max_uses != null && v.used_count >= v.max_uses) {
      return res.status(400).json({ message: 'Gutscheincode wurde bereits vollständig eingelöst' });
    }

    const amount = parseFloat(gross_amount) || 0;
    const discount_amount = v.discount_type === 'percent'
      ? Math.round(amount * v.discount_value / 100 * 100) / 100
      : Math.min(parseFloat(v.discount_value), amount);

    // remove any existing voucher usage for this report first
    const existing = await query('SELECT id, voucher_id FROM voucher_usages WHERE report_id = ?', [report_id]);
    if (existing.rows.length > 0) {
      const old = existing.rows[0] as any;
      await query('DELETE FROM voucher_usages WHERE report_id = ?', [report_id]);
      await query('UPDATE vouchers SET used_count = GREATEST(0, used_count - 1) WHERE id = ?', [old.voucher_id]);
      await query('UPDATE reports SET voucher_code = NULL, voucher_label = NULL, voucher_discount_amount = NULL WHERE id = ?', [report_id]);
    }

    const usageId = randomUUID();
    await query(
      'INSERT INTO voucher_usages (id, voucher_id, report_id, discount_amount) VALUES (?, ?, ?, ?)',
      [usageId, v.id, report_id, discount_amount]
    );
    await query('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?', [v.id]);
    await query(
      'UPDATE reports SET voucher_code = ?, voucher_label = ?, voucher_discount_amount = ? WHERE id = ?',
      [v.code, v.label, discount_amount, report_id]
    );

    res.json({ ok: true, discount_amount, voucher: v });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/vouchers/apply/:reportId — remove voucher from a report
router.delete('/apply/:reportId', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await query('SELECT id, voucher_id FROM voucher_usages WHERE report_id = ?', [req.params.reportId]);
    if (existing.rows.length > 0) {
      const old = existing.rows[0] as any;
      await query('DELETE FROM voucher_usages WHERE report_id = ?', [req.params.reportId]);
      await query('UPDATE vouchers SET used_count = GREATEST(0, used_count - 1) WHERE id = ?', [old.voucher_id]);
    }
    await query(
      'UPDATE reports SET voucher_code = NULL, voucher_label = NULL, voucher_discount_amount = NULL WHERE id = ?',
      [req.params.reportId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/vouchers/:id — update voucher (admin)
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { active, label, max_uses, expires_at, notes } = req.body;
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (active !== undefined) { sets.push('active = ?'); vals.push(active ? 1 : 0); }
    if (label !== undefined) { sets.push('label = ?'); vals.push(label); }
    if (max_uses !== undefined) { sets.push('max_uses = ?'); vals.push(max_uses || null); }
    if (expires_at !== undefined) { sets.push('expires_at = ?'); vals.push(expires_at || null); }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes); }
    if (sets.length === 0) return res.status(400).json({ message: 'No fields' });
    vals.push(req.params.id);
    await query(`UPDATE vouchers SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/vouchers/:id — hard delete (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM vouchers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
