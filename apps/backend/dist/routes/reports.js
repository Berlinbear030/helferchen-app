"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
// Create a report for a completed timelog
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { assignment_id, timelog_id, notes } = req.body;
    if (!assignment_id || !timelog_id) {
        return res.status(400).json({ message: 'assignment_id and timelog_id are required' });
    }
    // Check if timelog exists and is stopped
    const timelog = await queries_1.TimelogRepo.findById(String(timelog_id));
    if (!timelog)
        return res.status(404).json({ message: 'Timelog not found' });
    if (!timelog.end_time)
        return res.status(409).json({ message: 'Cannot create report for a running timer' });
    // Check if report already exists
    const existing = await queries_1.ReportRepo.findByTimelogId(String(timelog_id));
    if (existing)
        return res.status(409).json({ message: 'Report already exists for this timelog' });
    const report = await queries_1.ReportRepo.create(String(assignment_id), String(timelog_id), req.user.id, String(notes || ''));
    // addAudit('report', report.id, 'created', req.user!.id, `Report created for timelog ${timelog_id}`);
    res.status(201).json(report);
});
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const reports = await queries_1.ReportRepo.findByUserId(userId);
    res.json(reports);
});
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const reports = await queries_1.ReportRepo.findAll();
    res.json(reports);
});
// GET /api/reports/customer-stats — revenue aggregation per customer (admin)
router.get('/customer-stats', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    function calcPrice(minutes) {
        if (minutes <= 15)
            return 20;
        return 20 + Math.ceil((minutes - 15) / 15) * 15;
    }
    const reports = await queries_1.ReportRepo.findAll();
    const statsMap = {};
    await Promise.all(reports.map(async (report) => {
        const [timelog, assignment] = await Promise.all([
            queries_1.TimelogRepo.findById(report.timelog_id),
            queries_1.AssignmentRepo.findById(report.assignment_id),
        ]);
        if (!assignment)
            return;
        const minutes = (timelog?.start_time && timelog?.end_time)
            ? Math.max(0, Math.round((new Date(String(timelog.end_time).replace(' ', 'T') + (String(timelog.end_time).includes('Z') ? '' : 'Z')).getTime() -
                new Date(String(timelog.start_time).replace(' ', 'T') + (String(timelog.start_time).includes('Z') ? '' : 'Z')).getTime()) / 60000))
            : 0;
        const price = calcPrice(minutes);
        const customerId = assignment.customer_id;
        if (!statsMap[customerId])
            statsMap[customerId] = { total_revenue: 0, open_amount: 0 };
        statsMap[customerId].total_revenue += price;
        if (!report.signature_id)
            statsMap[customerId].open_amount += price;
    }));
    res.json(statsMap);
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    const report = await queries_1.ReportRepo.findById(String(req.params.id));
    if (!report)
        return res.status(404).json({ message: 'Not found' });
    res.json(report);
});
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('Auftrag loeschen'), async (req, res) => {
    const success = await queries_1.ReportRepo.delete(String(req.params.id));
    if (!success)
        return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
});
exports.default = router;
