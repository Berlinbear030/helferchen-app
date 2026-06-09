"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.authenticateToken, async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const allAssignments = req.user.role === 'admin'
        ? await queries_1.AssignmentRepo.findAll()
        : await queries_1.AssignmentRepo.findByUserId(req.user.id);
    const ensureStr = (d) => typeof d === 'string' ? d : d.toISOString();
    const todayAssignments = allAssignments.filter(a => ensureStr(a.scheduled_at).startsWith(today));
    const openAssignments = allAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
    const completedToday = todayAssignments.filter(a => a.status === 'completed');
    const completedMonth = allAssignments.filter(a => a.status === 'completed' && ensureStr(a.scheduled_at).startsWith(thisMonth));
    const revenuePerJob = 35;
    const openBookingRequests = await queries_1.BookingRequestRepo.countOpen();
    const recentAssignments = allAssignments
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
        .slice(0, 10);
    // Fetch customer data for recent assignments
    const enrichedAssignments = await Promise.all(recentAssignments.map(async (a) => ({
        ...a,
        customer: await queries_1.CustomerRepo.findById(a.customer_id)
    })));
    return res.json({
        today_appointments: todayAssignments.length,
        open_assignments: openAssignments.length,
        completed_today: completedToday.length,
        daily_revenue: completedToday.length * revenuePerJob,
        monthly_revenue: completedMonth.length * revenuePerJob,
        open_booking_requests: openBookingRequests,
        recent_assignments: enrichedAssignments,
    });
});
exports.default = router;
