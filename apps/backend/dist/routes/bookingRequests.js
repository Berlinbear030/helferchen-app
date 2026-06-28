"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const pool_1 = require("../db/pool");
const router = (0, express_1.Router)();
const bookingRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Stunde erneut.' },
});
async function verifyTurnstile(token, ip) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret)
        return true; // Skip verification when not configured (dev mode)
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);
    try {
        const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();
        return data.success === true;
    }
    catch (err) {
        console.error('[booking] Turnstile verification error:', err);
        return false;
    }
}
// Public: submit a booking request
router.post('/', bookingRateLimit, async (req, res) => {
    const { name, phone, email, address, street, house_number, zip, city, service_description, preferred_date, preferred_time, turnstileToken } = req.body;
    // Require either the combined address or the split fields
    const hasAddress = address || (street && zip && city);
    if (!name || !phone || !hasAddress || !service_description || !preferred_date || !preferred_time) {
        return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
    }
    // Verify CAPTCHA token
    if (process.env.TURNSTILE_SECRET_KEY) {
        if (!turnstileToken) {
            return res.status(400).json({ error: 'CAPTCHA-Verifizierung erforderlich.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
        const valid = await verifyTurnstile(turnstileToken, clientIp);
        if (!valid) {
            return res.status(400).json({ error: 'CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.' });
        }
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
    // Send emails asynchronously (don't block response)
    const emailData = {
        name,
        email: email || '',
        phone,
        preferred_date,
        preferred_time,
        service_description,
        street,
        house_number,
        zip,
        city,
        address: entry.address,
    };
    if (email) {
        (0, email_1.sendBookingConfirmation)(emailData).catch((err) => {
            console.error('[booking] Confirmation email error:', err?.message || err);
        });
    }
    (0, email_1.sendNewBookingAdminNotification)(emailData).catch((err) => {
        console.error('[booking] Admin notification error:', err?.message || err);
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
// Auth: delete a booking request (admin only)
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const id = req.params.id;
        // Unlink assignments that reference this booking request before deleting
        await (0, pool_1.query)('UPDATE assignments SET booking_request_id = NULL WHERE booking_request_id = ?', [id]);
        const success = await queries_1.BookingRequestRepo.delete(id);
        if (!success)
            return res.status(404).json({ error: 'Nicht gefunden.' });
        await queries_1.AuditRepo.create('booking_request', id, 'deleted', req.user.id, 'Booking request deleted');
        return res.status(204).send();
    }
    catch (err) {
        console.error('DELETE /booking-requests error:', err);
        return res.status(500).json({ message: 'Fehler beim Löschen der Anfrage', detail: err.message });
    }
});
exports.default = router;
