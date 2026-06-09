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
const telegram_1 = __importDefault(require("./telegram"));
const init_1 = require("./db/init");
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
app.use('/api/telegram', telegram_1.default);
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'Helferchen API', version: '1.0.0' });
});
async function start() {
    if (process.env.DATABASE_URL) {
        await (0, init_1.initDatabase)();
    }
    app.listen(port, () => {
        console.log(`Helferchen API running at http://localhost:${port}`);
    });
}
start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
