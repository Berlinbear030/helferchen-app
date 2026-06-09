"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    const customers = await queries_1.CustomerRepo.findAll();
    res.json(customers);
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const { first_name, last_name, address, phone_number, notes } = req.body;
    if (!first_name || !last_name)
        return res.status(400).json({ message: 'first_name and last_name are required' });
    const customer = await queries_1.CustomerRepo.create(String(first_name), String(last_name), String(address || ''), String(phone_number || ''), String(notes || ''));
    // addAudit('customer', customer.id, 'created', req.user!.id, `Customer ${first_name} ${last_name} created`);
    res.status(201).json(customer);
});
exports.default = router;
