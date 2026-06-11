"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
// Public: submit a booking request
router.post('/', async (req, res) => {
    const { name, phone, email, address, street, house_number, zip, city, service_description, preferred_date, preferred_time } = req.body;
    // Require either the combined address or the split fields
    const hasAddress = address || (street && zip && city);
    if (!name || !phone || !hasAddress || !service_description || !preferred_date || !preferred_time) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
    }
    const entry = await queries_1.BookingRequestRepo.create({
        name,
        phone,
        email,
        address,
        street,
        house_number,
        zip,
        city,
        service_description,
        preferred_date,
        preferred_time,
    });
    // Send confirmation email asynchronously (don't block response)
    if (email) {
        (0, email_1.sendBookingConfirmation)({
            name,
            email,
            preferred_date,
            preferred_time,
            service_description,
            street,
            house_number,
            zip,
            city,
            address: entry.address,
        }).catch(() => { });
    }
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
    // If status changed to 'assigned' and we have a user, create/update the actual assignment
    if (status === 'assigned' && assigned_user_id) {
        let existingAssignment = await queries_1.AssignmentRepo.findByBookingRequestId(entry.id);
        if (existingAssignment) {
            // Update existing assignment
            await queries_1.AssignmentRepo.reassign(existingAssignment.id, assigned_user_id);
        }
        else {
            // 1. Create a Customer record (split name into first/last)
            const nameParts = entry.name.split(' ');
            const firstName = nameParts[0] || 'Kunde';
            const lastName = nameParts.slice(1).join(' ') || 'Unbekannt';
            const customer = await queries_1.CustomerRepo.create(firstName, lastName, entry.address || 'Keine Adresse', entry.phone, `Erstellt aus Buchungsanfrage ${entry.id}`);
            // 2. Create the Assignment
            const scheduledAt = `${entry.preferred_date}T${entry.preferred_time}:00`;
            await queries_1.AssignmentRepo.create(customer.id, assigned_user_id, `Service: ${entry.service_description.slice(0, 30)}...`, entry.service_description, scheduledAt, entry.id);
        }
    }
    await queries_1.AuditRepo.create('booking_request', entry.id, 'update', req.user.id, JSON.stringify({ status, assigned_user_id }));
    return res.json(entry);
});
exports.default = router;
