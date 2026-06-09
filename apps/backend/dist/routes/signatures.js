"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
// POST /api/signatures — attach signature to a report, locks the timelog immutably
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { report_id, image_data, signer_name } = req.body;
    if (!report_id || !image_data || !signer_name) {
        return res.status(400).json({ message: 'report_id, image_data, and signer_name are required' });
    }
    const report = await queries_1.ReportRepo.findById(report_id);
    if (!report)
        return res.status(404).json({ message: 'Report not found' });
    if (report.signature_id)
        return res.status(409).json({ message: 'Report is already signed — immutable' });
    const timelog = await queries_1.TimelogRepo.findById(report.timelog_id);
    if (!timelog)
        return res.status(404).json({ message: 'Timelog not found' });
    if (!timelog.end_time)
        return res.status(409).json({ message: 'Cannot sign a report with a running timer' });
    const signature = await queries_1.SignatureRepo.create(report.timelog_id, image_data, signer_name);
    // Lock the timelog permanently
    await queries_1.TimelogRepo.updateSignedStatus(report.timelog_id, true);
    // Link signature to report
    await queries_1.ReportRepo.updateSignature(report_id, signature.id);
    res.status(201).json(signature);
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    const sig = await queries_1.SignatureRepo.findById(req.params.id);
    if (!sig)
        return res.status(404).json({ message: 'Not found' });
    res.json(sig);
});
exports.default = router;
