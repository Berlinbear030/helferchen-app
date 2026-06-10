"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const assignments = await queries_1.AssignmentRepo.findAll();
    // Join customer and user info using Repos (which have fallbacks)
    const result = await Promise.all(assignments.map(async (a) => {
        const customer = await queries_1.CustomerRepo.findById(a.customer_id);
        const user = await queries_1.UserRepo.findById(a.assigned_user_id);
        return { ...a, customer, assigned_user: user ? { id: user.id, full_name: user.full_name } : null };
    }));
    res.json(result);
});
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const assignments = await queries_1.AssignmentRepo.findByUserId(userId);
    const result = await Promise.all(assignments.map(async (a) => {
        const customer = await queries_1.CustomerRepo.findById(a.customer_id);
        return { ...a, customer };
    }));
    res.json(result);
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const { customer_id, assigned_user_id, title, description, scheduled_at } = req.body;
    if (!customer_id || !assigned_user_id || !title) {
        return res.status(400).json({ message: 'customer_id, assigned_user_id, and title are required' });
    }
    const assignment = await queries_1.AssignmentRepo.create(String(customer_id), String(assigned_user_id), String(title), String(description || ''), String(scheduled_at || new Date().toISOString()));
    res.status(201).json(assignment);
});
// GET /api/assignments/all — admin sees all assignments with customer + assigned user
router.get('/all', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const assignments = await queries_1.AssignmentRepo.findAll();
    const result = await Promise.all(assignments.map(async (a) => {
        const customer = await queries_1.CustomerRepo.findById(a.customer_id);
        const user = a.assigned_user_id ? await queries_1.UserRepo.findById(a.assigned_user_id) : null;
        return { ...a, customer, assigned_user: user ? { id: user.id, full_name: user.full_name } : null };
    }));
    res.json(result);
});
// GET /api/assignments/map — returns mine (green) + unassigned (yellow) for map display
router.get('/map', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const [mine, unassigned] = await Promise.all([
        queries_1.AssignmentRepo.findByUserId(userId),
        queries_1.AssignmentRepo.findUnassigned(),
    ]);
    const withCustomer = async (a) => {
        const customer = await queries_1.CustomerRepo.findById(a.customer_id);
        return { ...a, customer };
    };
    const [mineWithCustomer, unassignedWithCustomer] = await Promise.all([
        Promise.all(mine.map(withCustomer)),
        Promise.all(unassigned.map(withCustomer)),
    ]);
    res.json({ mine: mineWithCustomer, unassigned: unassignedWithCustomer });
});
// PATCH /api/assignments/:id — admin can reassign to a different employee
router.patch('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const assignment = await queries_1.AssignmentRepo.findById(String(req.params.id));
    if (!assignment)
        return res.status(404).json({ message: 'Assignment not found' });
    const { assigned_user_id, title, description, scheduled_at } = req.body;
    if (assigned_user_id !== undefined) {
        await queries_1.AssignmentRepo.reassign(String(req.params.id), assigned_user_id || null);
    }
    res.json({ ...assignment, assigned_user_id: assigned_user_id ?? assignment.assigned_user_id });
});
router.patch('/:id/status', auth_1.authenticateToken, async (req, res) => {
    const assignment = await queries_1.AssignmentRepo.findById(String(req.params.id));
    if (!assignment)
        return res.status(404).json({ message: 'Assignment not found' });
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status))
        return res.status(400).json({ message: 'Invalid status' });
    await queries_1.AssignmentRepo.updateStatus(String(req.params.id), String(status));
    res.json({ ...assignment, status });
});
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const success = await queries_1.AssignmentRepo.delete(String(req.params.id));
    if (!success)
        return res.status(404).json({ message: 'Assignment not found' });
    res.status(204).send();
});
exports.default = router;
