"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const assignments_1 = __importDefault(require("./routes/assignments"));
const timelogs_1 = __importDefault(require("./routes/timelogs"));
const customers_1 = __importDefault(require("./routes/customers"));
const reports_1 = __importDefault(require("./routes/reports"));
const signatures_1 = __importDefault(require("./routes/signatures"));
const pdf_1 = __importDefault(require("./routes/pdf"));
const admin_1 = __importDefault(require("./routes/admin"));
const bookingRequests_1 = __importDefault(require("./routes/bookingRequests"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const cron_1 = __importDefault(require("./routes/cron"));
const shop_1 = __importDefault(require("./routes/shop"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const vouchers_1 = __importDefault(require("./routes/vouchers"));
const telegram_1 = __importDefault(require("./telegram"));
const calls_1 = __importDefault(require("./routes/calls"));
const init_1 = require("./db/init");
const pool_1 = require("./db/pool");
const backup_1 = require("./services/backup");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' })); // larger limit for signature image blobs
app.use('/api/auth', auth_1.default);
app.use('/api/assignments', assignments_1.default);
app.use('/api/timelogs', timelogs_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/signatures', signatures_1.default);
app.use('/api/pdf', pdf_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/booking-requests', bookingRequests_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/cron', cron_1.default);
app.use('/api/shop', shop_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/vouchers', vouchers_1.default);
app.use('/api/telegram', telegram_1.default);
app.use('/api/calls', calls_1.default);
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'Helferchen API', version: '1.0.0' });
});
// Global error handler — catches any unhandled async error from route handlers
// and returns JSON instead of crashing or hanging the process
app.use((err, _req, res, _next) => {
    console.error('Unhandled route error:', err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Internal server error' });
});
async function start() {
    if (process.env.DATABASE_URL) {
        const connected = await (0, pool_1.testConnection)();
        if (connected) {
            try {
                await (0, init_1.initDatabase)();
                console.log('Database connected and initialized.');
                (0, pool_1.startKeepalive)(); // keep connections alive on shared hosting
            }
            catch (err) {
                console.error('Database schema init failed (running with DB):', err);
                (0, pool_1.startKeepalive)(); // still start keepalive even if init had issues
            }
        }
        else {
            console.warn('Database unreachable — running with in-memory fallback.');
        }
    }
    (0, backup_1.scheduleBackup)(); // daily database backup at 20:00
    app.listen(port, () => {
        console.log(`Helferchen API running at http://localhost:${port}`);
    });
}
start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
