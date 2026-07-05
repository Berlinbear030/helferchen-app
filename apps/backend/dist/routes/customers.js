"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    const customers = await queries_1.CustomerRepo.findAll();
    res.json(customers);
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const { first_name, last_name, address, phone_number, notes } = req.body;
    if (!first_name || !last_name)
        return res.status(400).json({ message: 'first_name and last_name are required' });
    const customer = await queries_1.CustomerRepo.create(String(first_name), String(last_name), String(address || ''), String(phone_number || ''), String(notes || ''));
    // addAudit('customer', customer.id, 'created', req.user!.id, `Customer ${first_name} ${last_name} created`);
    res.status(201).json(customer);
});
// DELETE /customers/:id — DSGVO: cascading hard delete (admin only)
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const id = req.params.id;
        const customer = await queries_1.CustomerRepo.findById(id);
        if (!customer)
            return res.status(404).json({ error: 'Nicht gefunden.' });
        // Cascade: get assignment IDs for this customer
        const assignRes = await (0, pool_1.query)('SELECT id FROM assignments WHERE customer_id = ?', [id]);
        const assignmentIds = assignRes.rows.map((a) => a.id);
        for (const aid of assignmentIds) {
            // Delete signatures first (FK: signatures.timelog_id -> time_logs.id)
            await (0, pool_1.query)('DELETE FROM signatures WHERE timelog_id IN (SELECT id FROM time_logs WHERE assignment_id = ?)', [aid]);
            await (0, pool_1.query)('DELETE FROM reports WHERE assignment_id = ?', [aid]);
            await (0, pool_1.query)('DELETE FROM time_logs WHERE assignment_id = ?', [aid]);
        }
        // Unlink booking_requests that reference these assignments
        if (assignmentIds.length > 0) {
            const placeholders = assignmentIds.map(() => '?').join(',');
            await (0, pool_1.query)(`UPDATE booking_requests SET assigned_user_id = NULL WHERE assigned_user_id IN (
           SELECT assigned_user_id FROM assignments WHERE id IN (${placeholders})
         )`, assignmentIds);
        }
        await (0, pool_1.query)('DELETE FROM assignments WHERE customer_id = ?', [id]);
        const success = await queries_1.CustomerRepo.delete(id);
        if (!success)
            return res.status(404).json({ error: 'Nicht gefunden.' });
        await queries_1.AuditRepo.create('customer', id, 'deleted', req.user.id, `Kunde gelöscht (DSGVO): ${customer.first_name} ${customer.last_name}`);
        return res.status(204).send();
    }
    catch (err) {
        console.error('DELETE /customers error:', err);
        return res.status(500).json({ message: 'Fehler beim Löschen des Kunden', detail: err.message });
    }
});
exports.default = router;
