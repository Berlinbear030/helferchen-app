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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const auth_1 = require("../middleware/auth");
const pool_1 = require("../db/pool");
const queries_1 = require("../db/queries");
const asterisk_1 = require("../services/asterisk");
const router = (0, express_1.Router)();
const WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET || 'HelferWebhook2026!';
// Helper function to write to /etc/asterisk files
function writeAsteriskFile(filename, content) {
    try {
        fs.writeFileSync(`/etc/asterisk/${filename}`, content);
    }
    catch (err) {
        try {
            (0, child_process_1.execSync)(`docker run --rm -v /etc/asterisk:/etc/asterisk alpine sh -c "cat << 'EOFCONFIG' > /etc/asterisk/${filename}\n${content}\nEOFCONFIG"`);
        }
        catch (dockerErr) {
            console.error(`Failed to write /etc/asterisk/${filename}:`, dockerErr);
            throw dockerErr;
        }
    }
}
// Helper function to reload Asterisk via AMI (tries 5038 and 5039)
async function reloadAsteriskConfig() {
    const portsToTry = process.env.AMI_PORT ? [parseInt(process.env.AMI_PORT, 10)] : [5038, 5039];
    let lastError = null;
    for (const port of portsToTry) {
        try {
            await new Promise((resolve, reject) => {
                const client = net.createConnection({ host: '127.0.0.1', port }, () => {
                    let buf = '';
                    client.on('data', (data) => {
                        buf += data.toString();
                        if (buf.includes('Asterisk Call Manager') && !buf.includes('Action:')) {
                            client.write(`Action: Login\r\nUsername: helferchen\r\nSecret: HelferAMI2026!\r\n\r\n`);
                        }
                        if (buf.includes('Authentication accepted')) {
                            client.write(`Action: Command\r\nCommand: pjsip reload\r\n\r\n`);
                            client.write(`Action: Command\r\nCommand: dialplan reload\r\n\r\n`);
                            client.write(`Action: Command\r\nCommand: voicemail reload\r\n\r\n`);
                            setTimeout(() => {
                                client.write('Action: Logoff\r\n\r\n');
                                client.destroy();
                                resolve();
                            }, 1000);
                        }
                    });
                    client.on('error', (err) => reject(err));
                });
                client.on('error', (err) => reject(err));
                // Timeout after 5 seconds for this port
                setTimeout(() => {
                    client.destroy();
                    reject(new Error(`Timeout connecting to port ${port}`));
                }, 5000);
            });
            // If we reach here, we succeeded!
            console.log(`[Asterisk] Reloaded successfully via AMI port ${port}`);
            return;
        }
        catch (err) {
            console.warn(`[Asterisk] Failed to reload via AMI port ${port}:`, err);
            lastError = err;
        }
    }
    throw lastError || new Error('Failed to connect to Asterisk AMI on all ports');
}
// Sync function to write config and reload Asterisk
async function syncAsterisk() {
    try {
        const users = await queries_1.SipUserRepo.findAll();
        // Separate homeasterisk (SIP trunk) from Linphone softphone users
        const linphoneUsers = users.filter(u => u.username !== 'homeasterisk');
        const homeAsteriskUser = users.find(u => u.username === 'homeasterisk');
        // 1. Generate pjsip_helferchen.conf
        // Transports must be at the top — transport changes require full Asterisk restart.
        // These values are fixed for this VPS.
        let pjsipContent = `; Autogenerated by Helferchen Backend — do not edit manually
; Transport changes require: systemctl restart asterisk

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=85.190.98.5
external_signaling_address=85.190.98.5

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5060
external_media_address=85.190.98.5
external_signaling_address=85.190.98.5

[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/helferchen-fullchain.pem
priv_key_file=/etc/asterisk/helferchen-privkey.pem
method=tlsv1_2
external_media_address=85.190.98.5
external_signaling_address=85.190.98.5

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0

`;
        // homeasterisk = the home-network Asterisk that bridges PYUR SIP to VPS
        // It uses context helferchen-from-home (not helferchen-incoming) to avoid loop
        if (homeAsteriskUser) {
            pjsipContent += `; ── Home-Asterisk PYUR Trunk ──────────────────────────────────────
[homeasterisk-auth]
type=auth
auth_type=userpass
username=homeasterisk
password=${homeAsteriskUser.password}

[homeasterisk]
type=aor
max_contacts=1
remove_existing=yes
default_expiration=1800
maximum_expiration=3600

[homeasterisk]
type=endpoint
transport=transport-tls
context=helferchen-from-home
disallow=all
allow=alaw,ulaw,g722
auth=homeasterisk-auth
aors=homeasterisk
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
trust_id_inbound=yes

`;
        }
        // Linphone softphone users (fabian, justin, etc.)
        for (const u of linphoneUsers) {
            pjsipContent += `; ── ${u.full_name} ──────────────────────────────────────
[${u.username}-auth]
type=auth
auth_type=userpass
username=${u.username}
password=${u.password}

[${u.username}]
type=aor
max_contacts=3
qualify_frequency=30
remove_existing=yes
default_expiration=1800
maximum_expiration=3600
minimum_expiration=60

[${u.username}]
type=endpoint
transport=transport-tls
context=helferchen-incoming
disallow=all
allow=alaw,ulaw,g722
auth=${u.username}-auth
aors=${u.username}
callerid="Helferchen" <030 71067627>
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
ice_support=no

`;
        }
        writeAsteriskFile('pjsip_helferchen.conf', pjsipContent);
        // 2. Generate extensions_helferchen.conf
        // helferchen-from-home: PYUR call arrives from home Asterisk → ring Linphone users
        // helferchen-incoming: direct dial to softphone users (callback, internal)
        let linphoneDialLine = ' same => n,NoOp(No Linphone users configured)';
        let callbackDialLine = ' same => n,NoOp(No Linphone users configured)';
        if (linphoneUsers.length > 0) {
            const linphoneTargets = linphoneUsers.map(u => `PJSIP/${u.username}`).join('&');
            linphoneDialLine = ` same => n,Dial(${linphoneTargets},25,m(helferchen))`;
            callbackDialLine = ` same => n,Dial(${linphoneTargets},60,m(helferchen))`;
        }
        const extensionsContent = `[helferchen-from-home]
; Eingehender PYUR-Anruf vom lokalen Asterisk (030 71067627)
exten => _[0-9+].,1,NoOp(PYUR-Anruf von \${CALLERID(num)})
 same => n,Answer()
 same => n,Wait(1)
 same => n,Playback(helferchen/welcome,noanswer)
${linphoneDialLine}
 same => n,GotoIf(\$["\${DIALSTATUS}" = "ANSWER"]?answered)
 same => n,Goto(voicemail)
 same => n(answered),Hangup()
 same => n(voicemail),Playback(helferchen/voicemail-prompt,noanswer)
 same => n,VoiceMail(shared@default,su)
 same => n,AGI(helferchen-notify.sh,\${CALLERID(num)},\${UNIQUEID})
 same => n,Hangup()
exten => anonymous,1,Goto(helferchen-from-home,0,1)
exten => 0,1,Answer()
 same => n,Wait(1)
 same => n,Playback(helferchen/welcome,noanswer)
${linphoneDialLine}
 same => n,GotoIf(\$["\${DIALSTATUS}" = "ANSWER"]?answered)
 same => n,Goto(voicemail)
 same => n(answered),Hangup()
 same => n(voicemail),Playback(helferchen/voicemail-prompt,noanswer)
 same => n,VoiceMail(shared@default,su)
 same => n,AGI(helferchen-notify.sh,\${CALLERID(num)},\${UNIQUEID})
 same => n,Hangup()

[helferchen-incoming]
; Direkte Anrufe an VPS-Nebenstellen (intern / Callback-Rueckruf)
exten => _[0-9+].,1,NoOp(Eingehender Anruf von \${CALLERID(num)})
 same => n,Answer()
 same => n,Wait(1)
 same => n,Playback(helferchen/welcome,noanswer)
${linphoneDialLine}
 same => n,GotoIf(\$["\${DIALSTATUS}" = "ANSWER"]?answered)
 same => n,Goto(voicemail)
 same => n(answered),Hangup()
 same => n(voicemail),Playback(helferchen/voicemail-prompt,noanswer)
 same => n,VoiceMail(shared@default,su)
 same => n,AGI(helferchen-notify.sh,\${CALLERID(num)},\${UNIQUEID})
 same => n,Hangup()

[helferchen-outgoing]
exten => _X.,1,Dial(PJSIP/\${EXTEN}@pyur-out,60)
 same => n,Hangup()

[helferchen-callback]
; VPS Backend ruft hier an fuer Rueckruf-Funktion
exten => s,1,NoOp(Rueckruf an \${CALLERID(num)})
 same => n,Answer()
 same => n,Playback(helferchen/callback-connecting)
${callbackDialLine}
 same => n,Hangup()
`;
        writeAsteriskFile('extensions_helferchen.conf', extensionsContent);
        // 3. Generate voicemail_helferchen.conf
        const voicemailContent = `[default]\nshared => 1234,Shared Voicemail,root@localhost\n`;
        writeAsteriskFile('voicemail_helferchen.conf', voicemailContent);
        // 4. Reload configurations
        await reloadAsteriskConfig();
        console.log('[Asterisk] Synchronized successfully.');
    }
    catch (err) {
        console.error('[Asterisk] Sync failed:', err);
    }
}
// GET /api/calls/presence — live SIP user status (online / in_call / offline)
router.get('/presence', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (_req, res) => {
    const users = await queries_1.SipUserRepo.findAll().catch(() => []);
    const linphoneUsers = users.filter((u) => u.username !== 'homeasterisk');
    try {
        const { online, inCall } = await (0, asterisk_1.queryAsteriskPresence)();
        const result = linphoneUsers.map((u) => ({
            id: u.id,
            username: u.username,
            full_name: u.full_name,
            status: inCall.has(u.username) ? 'in_call' : online.has(u.username) ? 'online' : 'offline',
        }));
        return res.json(result);
    }
    catch (_) {
        const result = linphoneUsers.map((u) => ({
            id: u.id,
            username: u.username,
            full_name: u.full_name,
            status: 'unknown',
        }));
        return res.json(result);
    }
});
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
        const portsToTry = process.env.AMI_PORT ? [parseInt(process.env.AMI_PORT, 10)] : [5038, 5039];
        let connected = false;
        const attemptConnect = (portIndex) => {
            if (portIndex >= portsToTry.length) {
                finish(500, { error: 'AMI-Verbindung auf allen Ports fehlgeschlagen' });
                return;
            }
            const port = portsToTry[portIndex];
            const client = net.createConnection({ host: '127.0.0.1', port }, () => {
                let buf = '';
                client.on('data', (data) => {
                    buf += data.toString();
                    if (buf.includes('Asterisk Call Manager') && !buf.includes('Action:')) {
                        client.write(`Action: Login\r\nUsername: helferchen\r\nSecret: HelferAMI2026!\r\n\r\n`);
                    }
                    if (buf.includes('Authentication accepted')) {
                        connected = true;
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
                client.on('error', () => {
                    if (!connected)
                        attemptConnect(portIndex + 1);
                });
            });
            client.on('error', () => {
                if (!connected)
                    attemptConnect(portIndex + 1);
            });
            // Timeout for this port
            setTimeout(() => {
                client.destroy();
                if (!connected)
                    attemptConnect(portIndex + 1);
            }, 5000);
        };
        attemptConnect(0);
    });
});
// GET /api/calls/sip-users — list SIP users
router.get('/sip-users', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const users = await queries_1.SipUserRepo.findAll();
        return res.json(users);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch SIP users: ' + err.message });
    }
});
// POST /api/calls/sip-users — create SIP user
router.post('/sip-users', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const { username, password, full_name } = req.body;
    if (!username || !password || !full_name) {
        return res.status(400).json({ error: 'Missing required fields: username, password, full_name' });
    }
    try {
        const existing = await queries_1.SipUserRepo.findByUsername(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const user = await queries_1.SipUserRepo.create(username, password, full_name);
        await syncAsterisk();
        return res.status(201).json(user);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to create SIP user: ' + err.message });
    }
});
// DELETE /api/calls/sip-users/:id — delete SIP user
router.delete('/sip-users/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    const id = String(req.params.id);
    try {
        const deleted = await queries_1.SipUserRepo.delete(id);
        if (!deleted) {
            return res.status(404).json({ error: 'SIP user not found' });
        }
        await syncAsterisk();
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to delete SIP user: ' + err.message });
    }
});
// GET /api/calls/voicemails — list voicemails
router.get('/voicemails', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const dir = '/var/spool/asterisk/voicemail/default/shared/INBOX';
    if (!fs.existsSync(dir)) {
        return res.json([]);
    }
    try {
        const files = fs.readdirSync(dir);
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        const voicemails = [];
        for (const f of txtFiles) {
            const id = f.replace('.txt', '');
            const txtPath = path.join(dir, f);
            const wavPath = path.join(dir, `${id}.wav`);
            if (!fs.existsSync(wavPath))
                continue;
            const txtContent = fs.readFileSync(txtPath, 'utf8');
            const lines = txtContent.split('\n');
            let callerId = 'Unbekannt';
            let timestamp = new Date().toISOString();
            let duration = 0;
            for (const line of lines) {
                if (line.startsWith('callerid=')) {
                    callerId = line.replace('callerid=', '').trim();
                }
                else if (line.startsWith('origtime=')) {
                    const origTimeSec = parseInt(line.replace('origtime=', '').trim(), 10);
                    if (!isNaN(origTimeSec)) {
                        timestamp = new Date(origTimeSec * 1000).toISOString();
                    }
                }
                else if (line.startsWith('duration=')) {
                    duration = parseInt(line.replace('duration=', '').trim(), 10);
                }
            }
            const stats = fs.statSync(wavPath);
            voicemails.push({
                id,
                callerId,
                timestamp,
                duration,
                fileSize: stats.size,
            });
        }
        // Sort newest first
        voicemails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return res.json(voicemails);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to list voicemails: ' + err.message });
    }
});
// GET /api/calls/voicemails/:id/audio — stream voicemail audio
router.get('/voicemails/:id/audio', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const id = String(req.params.id);
    const dir = '/var/spool/asterisk/voicemail/default/shared/INBOX';
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    const wavPath = path.join(dir, `${id}.wav`);
    if (!fs.existsSync(wavPath)) {
        return res.status(404).json({ error: 'Voicemail file not found' });
    }
    res.setHeader('Content-Type', 'audio/wav');
    fs.createReadStream(wavPath).pipe(res);
});
// DELETE /api/calls/voicemails/:id — delete voicemail
router.delete('/voicemails/:id', auth_1.authenticateToken, (0, auth_1.requireRole)('admin', 'kundenbetreuer'), async (req, res) => {
    const id = String(req.params.id);
    const dir = '/var/spool/asterisk/voicemail/default/shared/INBOX';
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    const txtPath = path.join(dir, `${id}.txt`);
    const wavPath = path.join(dir, `${id}.wav`);
    try {
        if (fs.existsSync(txtPath))
            fs.unlinkSync(txtPath);
        if (fs.existsSync(wavPath))
            fs.unlinkSync(wavPath);
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to delete voicemail: ' + err.message });
    }
});
exports.default = router;
