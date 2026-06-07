import { Router, Response } from 'express';
import { AssignmentRepo, BookingRequestRepo, CustomerRepo } from '../db/queries';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const allAssignments = req.user!.role === 'admin'
    ? await AssignmentRepo.findAll()
    : await AssignmentRepo.findByUserId(req.user!.id);

  const todayAssignments = allAssignments.filter(a => a.scheduled_at.startsWith(today));
  const openAssignments = allAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completedToday = todayAssignments.filter(a => a.status === 'completed');
  const completedMonth = allAssignments.filter(a =>
    a.status === 'completed' && a.scheduled_at.startsWith(thisMonth)
  );

  const revenuePerJob = 35;
  const openBookingRequests = await BookingRequestRepo.countOpen();
  
  const recentAssignments = allAssignments
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, 10);
    
  // Fetch customer data for recent assignments
  const enrichedAssignments = await Promise.all(recentAssignments.map(async a => ({
    ...a,
    customer: await CustomerRepo.findById(a.customer_id)
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

export default router;
