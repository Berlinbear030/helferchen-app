import { Router, Response } from 'express';
import db from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateToken, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const allAssignments = req.user!.role === 'admin'
    ? db.assignments
    : db.assignments.filter(a => a.assigned_user_id === req.user!.id);

  const todayAssignments = allAssignments.filter(a => a.scheduled_at.startsWith(today));
  const openAssignments = allAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completedToday = todayAssignments.filter(a => a.status === 'completed');
  const completedMonth = allAssignments.filter(a =>
    a.status === 'completed' && a.scheduled_at.startsWith(thisMonth)
  );

  const revenuePerJob = 35;
  const openBookingRequests = db.bookingRequests.filter(r => r.status === 'open').length;

  return res.json({
    today_appointments: todayAssignments.length,
    open_assignments: openAssignments.length,
    completed_today: completedToday.length,
    daily_revenue: completedToday.length * revenuePerJob,
    monthly_revenue: completedMonth.length * revenuePerJob,
    open_booking_requests: openBookingRequests,
    recent_assignments: allAssignments
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, 10)
      .map(a => ({
        ...a,
        customer: db.customers.find(c => c.id === a.customer_id) || null,
      })),
  });
});

export default router;
