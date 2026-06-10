"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public: submit a booking request
router.post('/', async (req, res) => {
    const { name, phone, email, address, service_description, preferred_date, preferred_time } = req.body;
    if (!name || !phone || !address || !service_description || !preferred_date || !preferred_time) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
    }
    const entry = await queries_1.BookingRequestRepo.create({
        name,
        phone,
        email,
        address,
        service_description,
        preferred_date,
        preferred_time
    });
    return res.status(201).json(entry);
});
// Auth: list all booking requests
router.get('/', auth_1.authenticateToken, async (req, res) => {
    const { status } = req.query;
    const list = await queries_1.BookingRequestRepo.findAll(status);
    return res.json(list);
});
// Auth: update status / assign
router.patch('/:id', auth_1.authenticateToken, async (req, res) => {
    const { status, assigned_user_id, notes } = req.body;
    const oldEntry = await queries_1.BookingRequestRepo.findById(req.params.id);
    if (!oldEntry)
        return res.status(404).json({ error: 'Nicht gefunden.' });
    const entry = await queries_1.BookingRequestRepo.update(req.params.id, { status, assigned_user_id, notes });
    if (!entry)
        return res.status(404).json({ error: 'Nicht gefunden.' });
    // If status changed to 'assigned' and we have a user, create the actual assignment
    if (status === 'assigned' && assigned_user_id) {
        // 1. Create a Customer record (split name into first/last)
        const nameParts = entry.name.split(' ');
        const firstName = nameParts[0] || 'Kunde';
        const lastName = nameParts.slice(1).join(' ') || 'Unbekannt';
        const customer = await queries_1.CustomerRepo.create(firstName, lastName, entry.address || 'Keine Adresse', entry.phone, `Erstellt aus Buchungsanfrage ${entry.id}`);
        // 2. Create the Assignment
        const scheduledAt = `${entry.preferred_date}T${entry.preferred_time}:00`;
        await queries_1.AssignmentRepo.create(customer.id, assigned_user_id, `Service: ${entry.service_description.slice(0, 30)}...`, entry.service_description, scheduledAt);
    }
    await queries_1.AuditRepo.create('booking_request', entry.id, 'update', req.user.id, JSON.stringify({ status, assigned_user_id }));
    return res.json(entry);
});
exports.default = router;
