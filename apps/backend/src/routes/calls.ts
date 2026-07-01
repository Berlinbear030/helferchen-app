import { Router, Request, Response } from 'express';
import * as net from 'net';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth';
import { query } from '../db/pool';

const router = Router();
const WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET || 'HelferWebhook2026!';

// POST /api/calls/webhook — Asterisk AGI notifies of missed call
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = req.headers['x-helferchen-secret'];
  if (secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Forbidden' });

  const { type, caller_id, unique_id, timestamp } = req.body;
  if (type === 'missed_call' && caller_id) {
    await query(
      'INSERT INTO call_logs (caller_id, unique_id, status) VALUES (?, ?, ?)',
      [String(caller_id), unique_id ? String(unique_id) : null, 'missed']
    ).catch((err: any) => console.error('call_logs insert error:', err));
  }
  return res.json({ ok: true });
});

// GET /api/calls — list call logs (admin + kundenbetreuer)
router.get('/', authenticateToken, requireRole('admin', 'kundenbetreuer'), async (_req: AuthRequest, res: Response) => {
  const result = await query(
    'SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 200',
    []
  ).catch(() => ({ rows: [] as any[] }));
  return res.json(result.rows || []);
});

// PATCH /api/calls/:id — update status or note
router.patch('/:id', authenticateToken, requireRole('admin', 'kundenbetreuer'), async (req: AuthRequest, res: Response) => {
  const { status, note } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (note !== undefined) { updates.push('note = ?'); params.push(note); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  await query(`UPDATE call_logs SET ${updates.join(', ')} WHERE id = ?`, params);
  return res.json({ ok: true });
});

// POST /api/calls/:id/callback — Asterisk AMI calls Linphone first, then bridges to customer
router.post('/:id/callback', authenticateToken, requireRole('admin', 'kundenbetreuer'), async (req: AuthRequest, res: Response) => {
  const result = await query('SELECT * FROM call_logs WHERE id = ?', [req.params.id]).catch(() => ({ rows: [] as any[] }));
  const call = (result.rows || [])[0];
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const customerNum = String(call.caller_id).replace(/[^0-9+]/g, '');

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (code: number, body: object) => {
      if (done) return;
      done = true;
      res.status(code).json(body);
      resolve();
    };

    // AMI_PORT 5039 = SSH reverse tunnel → home Asterisk (port 5038)
    // Originate via pyur-out: local Asterisk dials forward number (mobile) directly,
    // after answering, helferchen-callback context dials customer via pyur-out
    const AMI_PORT = parseInt(process.env.AMI_PORT || '5039', 10);
    const FORWARD_NUMBER = process.env.AMI_FORWARD_NUMBER || '015222074984';
    const client = net.createConnection({ host: '127.0.0.1', port: AMI_PORT }, () => {
      let buf = '';
      client.on('data', (data: Buffer) => {
        buf += data.toString();
        if (buf.includes('Asterisk Call Manager') && !buf.includes('Action:')) {
          client.write(`Action: Login\r\nUsername: helferchen\r\nSecret: HelferAMI2026!\r\n\r\n`);
        }
        if (buf.includes('Authentication accepted')) {
          client.write(
            `Action: Originate\r\n` +
            `Channel: PJSIP/${FORWARD_NUMBER}@pyur-out\r\n` +
            `Context: helferchen-callback\r\n` +
            `Exten: s\r\n` +
            `Priority: 1\r\n` +
            `CallerID: Helferchen <030 71067627>\r\n` +
            `Timeout: 30000\r\n` +
            `Variable: CUSTOMER_NUM=${customerNum}\r\n` +
            `Async: true\r\n\r\n`
          );
          setTimeout(() => {
            client.write('Action: Logoff\r\n\r\n');
            client.destroy();
            query('UPDATE call_logs SET status=? WHERE id=?', ['callback_initiated', req.params.id]).catch(() => {});
            finish(200, { ok: true, message: `Handy (${FORWARD_NUMBER}) klingelt – nach Abheben wird Kunde verbunden` });
          }, 1500);
        }
      });
      client.on('error', () => finish(500, { error: 'AMI-Verbindung fehlgeschlagen' }));
    });
    client.on('error', () => finish(500, { error: `AMI nicht erreichbar (Port ${AMI_PORT})` }));
    setTimeout(() => { client.destroy(); finish(504, { error: 'Timeout' }); }, 10000);
  });
});

export default router;
