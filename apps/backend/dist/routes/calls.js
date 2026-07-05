"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const net = __importStar(require("net"));
const auth_1 = require("../middleware/auth");
const pool_1 = require("../db/pool");
const router = (0, express_1.Router)();
const WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET || 'HelferWebhook2026!';
// POST /api/calls/webhook — Asterisk AGI notifies of missed call
router.post('/webhook', async (req, res) => {
    const secret = req.headers['x-helferchen-secret'];
    if (secret !== WEBHOOK_SECRET)
        return res.status(403).json({ error: 'Forbidden' });
    const { type, caller_id, unique_id, timestamp } = req.body;
    if (type === 'missed_call' && caller_id) {
        await (0, pool_1.query)('INSERT INTO call_logs (caller_id, unique_id, status) VALUES (?, ?, ?)', [String(caller_id), unique_id ? String(unique_id) : null, 'missed']).catch((err) => console.error('call_logs insert error:', err));
    }
    return res.json({ ok: true });
});
// GET /api/calls — list call logs (admin + kundenbetreuer)
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (_req, res) => {
    const result = await (0, pool_1.query)('SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 200', []).catch(() => ({ rows: [] }));
    return res.json(result.rows || []);
});
// PATCH /api/calls/:id — update status or note
router.patch('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const { status, note } = req.body;
    const updates = [];
    const params = [];
    if (status) {
        updates.push('status = ?');
        params.push(status);
    }
    if (note !== undefined) {
        updates.push('note = ?');
        params.push(note);
    }
    if (updates.length === 0)
        return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await (0, pool_1.query)(`UPDATE call_logs SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ ok: true });
});
// POST /api/calls/:id/callback — Asterisk AMI calls Linphone first, then bridges to customer
router.post('/:id/callback', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const result = await (0, pool_1.query)('SELECT * FROM call_logs WHERE id = ?', [req.params.id]).catch(() => ({ rows: [] }));
    const call = (result.rows || [])[0];
    if (!call)
        return res.status(404).json({ error: 'Call not found' });
    const customerNum = String(call.caller_id).replace(/[^0-9+]/g, '');
    return new Promise((resolve) => {
        let done = false;
        const finish = (code, body) => {
            if (done)
                return;
            done = true;
            res.status(code).json(body);
            resolve();
        };
        // AMI_PORT 5039 = SSH reverse tunnel → home Asterisk (port 5038)
        // Originate via vps-trunk: local Asterisk dials VPS which rings Linphone (fabian)
        // After Linphone answers, helferchen-callback context dials customer via pyur-out
        const AMI_PORT = parseInt(process.env.AMI_PORT || '5039', 10);
        const client = net.createConnection({ host: '127.0.0.1', port: AMI_PORT }, () => {
            let buf = '';
            client.on('data', (data) => {
                buf += data.toString();
                if (buf.includes('Asterisk Call Manager') && !buf.includes('Action:')) {
                    client.write(`Action: Login\r\nUsername: helferchen\r\nSecret: HelferAMI2026!\r\n\r\n`);
                }
                if (buf.includes('Authentication accepted')) {
                    client.write(`Action: Originate\r\n` +
                        `Channel: PJSIP/99@vps-trunk\r\n` +
                        `Context: helferchen-callback\r\n` +
                        `Exten: s\r\n` +
                        `Priority: 1\r\n` +
                        `CallerID: Helferchen <030 71067627>\r\n` +
                        `Timeout: 30000\r\n` +
                        `Variable: CUSTOMER_NUM=${customerNum}\r\n` +
                        `Async: true\r\n\r\n`);
                    setTimeout(() => {
                        client.write('Action: Logoff\r\n\r\n');
                        client.destroy();
                        (0, pool_1.query)('UPDATE call_logs SET status=? WHERE id=?', ['callback_initiated', req.params.id]).catch(() => { });
                        finish(200, { ok: true, message: 'Linphone klingelt – nach Abheben wird Kunde verbunden' });
                    }, 1500);
                }
            });
            client.on('error', () => finish(500, { error: 'AMI-Verbindung fehlgeschlagen' }));
        });
        client.on('error', () => finish(500, { error: `AMI nicht erreichbar (Port ${AMI_PORT})` }));
        setTimeout(() => { client.destroy(); finish(504, { error: 'Timeout' }); }, 10000);
    });
});
exports.default = router;
