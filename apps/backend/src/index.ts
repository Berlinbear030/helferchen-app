import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import assignmentRoutes from './routes/assignments';
import timelogRoutes from './routes/timelogs';
import customerRoutes from './routes/customers';
import reportRoutes from './routes/reports';
import signatureRoutes from './routes/signatures';
import pdfRoutes from './routes/pdf';
import adminRoutes from './routes/admin';
import bookingRequestRoutes from './routes/bookingRequests';
import dashboardRoutes from './routes/dashboard';
import cronRoutes from './routes/cron';
import shopRoutes from './routes/shop';
import invoiceRoutes from './routes/invoices';
import voucherRoutes from './routes/vouchers';
import telegramRoutes from './telegram';
import callRoutes from './routes/calls';
import { initDatabase } from './db/init';
import { testConnection, startKeepalive } from './db/pool';
import { scheduleBackup } from './services/backup';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // larger limit for signature image blobs

app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/timelogs', timelogRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking-requests', bookingRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/calls', callRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Helferchen API', version: '1.0.0' });
});

// Global error handler — catches any unhandled async error from route handlers
// and returns JSON instead of crashing or hanging the process
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled route error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

async function start() {
  if (process.env.DATABASE_URL) {
    const connected = await testConnection();
    if (connected) {
      try {
        await initDatabase();
        console.log('Database connected and initialized.');
        startKeepalive(); // keep connections alive on shared hosting
      } catch (err) {
        console.error('Database schema init failed (running with DB):', err);
        startKeepalive(); // still start keepalive even if init had issues
      }
    } else {
      console.warn('Database unreachable — running with in-memory fallback.');
    }
  }
  scheduleBackup(); // daily database backup at 20:00
  app.listen(port, () => {
    console.log(`Helferchen API running at http://localhost:${port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
