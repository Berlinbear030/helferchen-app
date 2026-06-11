"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
// Endpoint for triggering report generation (protected by a secret)
router.post('/report', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!process.env.CRON_SECRET || authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // 1. Fetch recent activity (e.g., last 100 entries)
        const recentLogs = await queries_1.AuditRepo.findAll({ limit: 100 });
        // 2. Generate report text
        const newline = String.fromCharCode(10);
        let reportLines = ["# Automated Activity Report", "", "Generated at: " + new Date().toISOString(), "", "## Recent Audit Logs:"];
        recentLogs.forEach(log => {
            reportLines.push("- [" + log.timestamp + "] " + log.entity_type + " " + log.entity_id + ": " + log.action + " by " + log.actor_user_id);
        });
        let report = reportLines.join(newline);
        // For now, we just log the report to console as GitHub is forbidden
        console.log('Generated Report:', report);
        res.status(200).json({ message: 'Report generated successfully (logging to console)' });
    }
    catch (error) {
        console.error('Error in cron report generation:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
});
exports.default = router;
