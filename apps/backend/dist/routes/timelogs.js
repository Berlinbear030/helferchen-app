"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
// POST /api/timelogs/start — server-side start, client cannot set timestamp
router.post('/start', auth_1.authenticateToken, async (req, res) => {
    const { assignment_id } = req.body;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const existing = await queries_1.TimelogRepo.findActive(userId, assignment_id);
    if (existing) {
        return res.status(409).json({ message: 'Timer already running for this assignment' });
    }
    const timelog = await queries_1.TimelogRepo.create(userId, assignment_id);
    res.status(201).json(timelog);
});
// POST /api/timelogs/stop — server-side stop
router.post('/stop', auth_1.authenticateToken, async (req, res) => {
    const { timelog_id } = req.body;
    const userId = req.user?.id;
    // We should check if the timelog exists and belongs to the user
    // For now, simpler:
    try {
        const timelog = await queries_1.TimelogRepo.stop(timelog_id);
        res.json(timelog);
    }
    catch (e) {
        res.status(404).json({ message: 'Timelog not found or already stopped' });
    }
});
// GET /api/timelogs/my — timelogs for current user
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const logs = await queries_1.TimelogRepo.findByUserId(userId);
    res.json(logs);
});
exports.default = router;
