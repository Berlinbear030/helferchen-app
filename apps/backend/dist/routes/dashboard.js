"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queries_1 = require("../db/queries");
const auth_1 = require("../middleware/auth");
const pool_1 = require("../db/pool");
const router = (0, express_1.Router)();
// €20 first 15 min, +€15 per additional 15-min block — mirrors MobileApp calcPrice
function calcPriceFromMinutes(minutes) {
    if (minutes <= 0)
        return 0;
    if (minutes <= 15)
        return 20;
    return 20 + Math.ceil((minutes - 15) / 15) * 15;
}
// Returns a map of assignment_id → actual invoiced revenue (after overrides and voucher discounts)
async function fetchRevenueMap(ids) {
    if (!ids.length || !pool_1.dbConnected)
        return {};
    const ph = ids.map(() => '?').join(',');
    const res = await (0, pool_1.query)(`
    SELECT tl.assignment_id,
      SUM(GREATEST(0,
        COALESCE(r.invoice_amount_override,
          CASE
            WHEN tl.total_price IS NOT NULL THEN tl.total_price
            WHEN tl.duration_minutes IS NOT NULL AND tl.duration_minutes <= 15 THEN 20
            WHEN tl.duration_minutes IS NOT NULL THEN 20 + CEIL((tl.duration_minutes - 15.0) / 15) * 15
            ELSE 0
          END
        ) - COALESCE(r.voucher_discount_amount, 0)
      )) as revenue
    FROM time_logs tl
    LEFT JOIN reports r ON r.timelog_id = tl.id
    WHERE tl.assignment_id IN (${ph}) AND tl.end_time IS NOT NULL
    GROUP BY tl.assignment_id
  `, ids);
    const map = {};
    for (const row of res.rows) {
        if (row.revenue !== null)
            map[row.assignment_id] = parseFloat(row.revenue);
    }
    return map;
}
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
    const openBookingRequests = await queries_1.BookingRequestRepo.countOpen();
    // Get actual prices from time_logs for completed sets
    const [dailyRevMap, monthlyRevMap] = await Promise.all([
        fetchRevenueMap(completedToday.map(a => a.id)),
        fetchRevenueMap(completedMonth.map(a => a.id)),
    ]);
    // Enrich an assignment list with customer, assigned_user, and optional revenue
    async function enrich(list, revMap) {
        return Promise.all(list.map(async (a) => {
            const customer = await queries_1.CustomerRepo.findById(a.customer_id);
            const user = a.assigned_user_id ? await queries_1.UserRepo.findById(a.assigned_user_id) : null;
            const entry = {
                ...a,
                customer,
                assigned_user: user ? { id: user.id, full_name: user.full_name } : null,
            };
            if (revMap) {
                // Use stored timelog price; fall back to 35 if no timelog recorded yet
                entry.revenue = revMap[a.id] ?? 35;
            }
            return entry;
        }));
    }
    const [dailyCompleted, monthlyCompleted, openList, enrichedRecent] = await Promise.all([
        enrich(completedToday, dailyRevMap),
        enrich(completedMonth, monthlyRevMap),
        enrich(openAssignments.slice(0, 100)),
        enrich([...allAssignments]
            .sort((a, b) => new Date(ensureStr(b.scheduled_at)).getTime() - new Date(ensureStr(a.scheduled_at)).getTime())
            .slice(0, 10)),
    ]);
    const dailyRevenue = dailyCompleted.reduce((s, a) => s + a.revenue, 0);
    const monthlyRevenue = monthlyCompleted.reduce((s, a) => s + a.revenue, 0);
    return res.json({
        today_appointments: todayAssignments.length,
        open_assignments: openAssignments.length,
        completed_today: completedToday.length,
        daily_revenue: dailyRevenue,
        monthly_revenue: monthlyRevenue,
        open_booking_requests: openBookingRequests,
        recent_assignments: enrichedRecent,
        daily_completed: dailyCompleted,
        monthly_completed: monthlyCompleted,
        open_assignments_list: openList,
    });
});
exports.default = router;
