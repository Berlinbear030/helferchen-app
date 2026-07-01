import express from 'express';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomBytes, createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5555;

// === AUTH CONFIG ===
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '29913041';
const sessions = new Map(); // token → expiresAt
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function createSession() {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (sessions.get(token) < Date.now()) { sessions.delete(token); return false; }
  return true;
}

function getToken(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

function requireAuth(req, res, next) {
  if (isValidSession(getToken(req))) return next();
  res.status(401).json({ error: 'Nicht angemeldet' });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === LOGIN ===
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    const token = createSession();
    res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}`);
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Falsches Passwort' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = getToken(req);
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: isValidSession(getToken(req)) });
});

// === CREDENTIALS DATA ===
const PASSWORDS_FILE = join(__dirname, 'passwords.md');

function loadCredentials() {
  if (!existsSync(PASSWORDS_FILE)) return null;
  return readFileSync(PASSWORDS_FILE, 'utf-8');
}

// Parse the markdown into structured sections
function parseCredentialSections(md) {
  const sections = [];
  const lines = md.split('\n');
  let current = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2) {
      if (current) sections.push(current);
      current = { title: h2[1].trim(), subtitle: null, content: [] };
    } else if (h3 && current) {
      current.content.push({ type: 'h3', text: h3[1].trim() });
    } else if (current) {
      current.content.push({ type: 'line', text: line });
    }
  }
  if (current) sections.push(current);
  return sections;
}

app.get('/api/credentials', requireAuth, (req, res) => {
  const md = loadCredentials();
  if (!md) return res.status(404).json({ error: 'passwords.md nicht gefunden' });
  const html = marked.parse(md);
  res.json({ html, raw: md });
});

// === STATIC: serve index.html for all non-api routes ===
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.send(buildHtml());
});

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🔐 Helferchen – Zugangsdaten</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #00454A;
      --primary-light: #006d74;
      --accent: #FFB300;
      --bg: #0f1117;
      --bg-card: #1a1d24;
      --bg-hover: #22262f;
      --border: #2d3240;
      --text: #e8ecf0;
      --text-muted: #8892a0;
      --success: #10B981;
      --error: #EF4444;
      --warning: #F59E0B;
      --radius: 10px;
    }

    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* ===== LOGIN ===== */
    #login-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .login-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 40px 36px;
      width: 100%;
      max-width: 380px;
      text-align: center;
    }

    .login-card .logo { font-size: 42px; margin-bottom: 12px; }
    .login-card h1 { font-size: 20px; color: var(--accent); margin-bottom: 6px; }
    .login-card p { font-size: 13px; color: var(--text-muted); margin-bottom: 28px; }

    .login-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      padding: 12px 14px;
      font-size: 15px;
      outline: none;
      margin-bottom: 14px;
      letter-spacing: 0.05em;
    }

    .login-input:focus { border-color: var(--primary-light); }

    .login-btn {
      width: 100%;
      background: var(--primary);
      border: none;
      border-radius: 8px;
      color: white;
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .login-btn:hover { background: var(--primary-light); }

    .login-error {
      color: var(--error);
      font-size: 13px;
      margin-top: 10px;
      display: none;
    }

    /* ===== MAIN APP ===== */
    #app-screen { display: none; }

    header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    header h1 {
      font-size: 17px;
      font-weight: 700;
      color: var(--accent);
      flex: 1;
    }

    header p { font-size: 12px; color: var(--text-muted); }

    .logout-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-muted);
      padding: 6px 14px;
      font-size: 12px;
      cursor: pointer;
    }

    .logout-btn:hover { background: var(--bg-hover); color: var(--text); }

    /* ===== CONTENT ===== */
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 28px 24px;
    }

    .section-block {
      margin-bottom: 32px;
    }

    .section-header {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .subsection-header {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-light);
      margin: 16px 0 8px;
    }

    /* ===== TABLE ===== */
    .cred-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .cred-table th {
      background: var(--bg);
      padding: 9px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .cred-table td {
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      vertical-align: middle;
    }

    .cred-table tr:hover td { background: var(--bg-hover); }

    .cred-table .val {
      font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace;
      color: var(--text);
    }

    .cred-table .val.secret {
      filter: blur(5px);
      transition: filter 0.2s;
      cursor: pointer;
    }

    .cred-table .val.secret.revealed { filter: none; }

    .copy-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text-muted);
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .copy-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
    .copy-btn.copied { background: var(--success); color: white; border-color: var(--success); }

    /* ===== NOTE BLOCKS ===== */
    .note-block {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--warning);
      border-radius: 7px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 12px;
      line-height: 1.6;
    }

    .note-block.info { border-left-color: var(--primary-light); }

    /* ===== TOAST ===== */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--success);
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.2s;
      pointer-events: none;
      z-index: 999;
    }
    #toast.show { opacity: 1; transform: none; }

    /* ===== LOADING ===== */
    #loading-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: var(--text-muted);
      gap: 10px;
      font-size: 14px;
    }

    .spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>

<div id="loading-screen">
  <div class="spinner"></div>
  Wird geladen…
</div>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-card">
    <div class="logo">🔐</div>
    <h1>Helferchen Dashboard</h1>
    <p>Bitte Passwort eingeben, um fortzufahren</p>
    <input type="password" id="pw-input" class="login-input" placeholder="Passwort" autocomplete="current-password" />
    <button class="login-btn" id="login-btn">Anmelden</button>
    <div class="login-error" id="login-error">Falsches Passwort</div>
  </div>
</div>

<!-- MAIN APP -->
<div id="app-screen">
  <header>
    <span style="font-size:22px">🏠</span>
    <h1>Helferchen – Zugangsdaten</h1>
    <p id="last-updated"></p>
    <button class="logout-btn" id="logout-btn">Abmelden</button>
  </header>
  <main id="cred-content">
    <div style="color:var(--text-muted);padding:40px;text-align:center">
      <div class="spinner" style="margin:0 auto 12px"></div>
      Zugangsdaten werden geladen…
    </div>
  </main>
</div>

<div id="toast">✓ Kopiert!</div>

<script>
// ===== UTILS =====
const toast = document.getElementById('toast');
let toastTimer;

function showToast(msg = '✓ Kopiert!') {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  }
  showToast();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== AUTH =====
async function checkAuth() {
  const res = await fetch('/api/auth-check');
  const d = await res.json();
  return d.authenticated;
}

async function login(pw) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  return res.ok;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

// ===== CREDENTIAL RENDERER =====
function renderTable(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const isSecret = (key) => /pass|token|secret|key|pwd|pw/i.test(key);

  let html = '<table class="cred-table"><thead><tr>';
  for (const h of headers) html += \`<th>\${esc(h)}</th>\`;
  html += '<th></th></thead><tbody>';

  for (const row of rows) {
    html += '<tr>';
    for (const [k, v] of Object.entries(row)) {
      const secret = isSecret(k);
      html += \`<td class="val\${secret ? ' secret' : ''}" \${secret ? 'title="Klicken zum Anzeigen"' : ''}>\${esc(v||'—')}</td>\`;
    }
    // Copy the whole row as text
    const rowText = Object.values(row).join(' | ');
    html += \`<td><button class="copy-btn" data-val="\${esc(JSON.stringify(row))}">Kopieren</button></td>\`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// Hardcoded structured data from passwords.md
const CREDENTIAL_SECTIONS = [
  {
    title: '🖥️ VPS-Server (85.190.98.5 / helferchen.info)',
    note: 'SSH-Schlüssel ist primäre Methode. Root-Passwort nur für Notfall.',
    rows: [
      { Dienst: 'SSH Root-Zugang', Benutzername: 'root', Passwort: '38!UTVq!$dMhxi!DeSs1%990', Hinweis: 'root@85.190.98.5' },
      { Dienst: 'Webmin Panel', URL: 'https://localhost:10000', Benutzername: 'root', Passwort: 'Wx9#mK2$pLqN7@vR4hT', Hinweis: 'SSH-Tunnel: ssh -L 10000:localhost:10000 root@85.190.98.5' },
    ],
  },
  {
    title: '📧 E-Mail-Konten (helferchen.info)',
    note: '⚠️ info@helferchen.info war das kompromittierte Konto (Phishing-Quelle). Server: helferchen.info, Port: 587 (STARTTLS)',
    rows: [
      { 'E-Mail': 'info@helferchen.info ⚠️', Passwort: '2!1!3#UQwdRf%UNA*PMJuhzm' },
      { 'E-Mail': 'kundenservice@helferchen.info', Passwort: 'T&3&i277iIN@BuEjn%3lpxMr' },
      { 'E-Mail': 'no-reply@helferchen.info', Passwort: 'jl2rz3#vhCXnVClEUW*Wge&J' },
      { 'E-Mail': 'no-replay@helferchen.info', Passwort: '4vu0g6D^uD9K6%tYEoo2xc%f' },
      { 'E-Mail': 'schroeder@helferchen.info', Passwort: 'V6VZ1eT$r8@rOEY2alnjMBa*' },
      { 'E-Mail': 'shop@helferchen.info', Passwort: 'GVDY@HFiqzoUk#Z@l!lNJ6xN' },
      { 'E-Mail': 'test@helferchen.info', Passwort: '59Su8oUaCZIBsy$z8zYq1trP' },
    ],
  },
  {
    title: '🔐 Helferchen-Portal Benutzer (helferchen.info)',
    rows: [
      { Benutzername: 'admin (Fabian Marquardt)', Rolle: 'Admin', Passwort: 'jf#1Iz3E0ht@zcw@Yvx!6YNc' },
      { Benutzername: 'board', Rolle: 'Admin', Passwort: 'EGy$q7GTOXLGTO&kht3BJFRb' },
      { Benutzername: 'schroderf06 (Franzisca Schröder)', Rolle: 'Admin', Passwort: 'V6VZ1eT$r8@rOEY2alnjMBa*' },
      { Benutzername: 'Justin (Justin Schröder)', Rolle: 'Admin', Passwort: 'V6VZ1eT$r8@rOEY2alnjMBa*' },
      { Benutzername: 'employee1 (Max Mustermann)', Rolle: 'Mitarbeiter', Passwort: '3sAJi#!u1%8zZmMI^xsuZtG1' },
      { Benutzername: 'Testmitarbeiter', Rolle: 'Mitarbeiter', Passwort: 'jf#1Iz3E0ht@zcw@Yvx!6YNc' },
    ],
  },
  {
    title: '🗄️ Datenbanken',
    subsections: [
      {
        subtitle: 'Helferchen MySQL (lokal auf Server)',
        rows: [
          { Parameter: 'Host', Wert: 'localhost:3306' },
          { Parameter: 'Datenbank', Wert: 'helferchen' },
          { Parameter: 'Benutzername', Wert: 'helferchen' },
          { Parameter: 'Passwort', Wert: 'LF!zb$V1&rcgLq065$&uDuM8' },
        ],
      },
      {
        subtitle: 'Fahrschulpro PostgreSQL (Docker)',
        rows: [
          { Parameter: 'Host', Wert: 'localhost:5434 (nur intern)' },
          { Parameter: 'Datenbank', Wert: 'fahrschulpro' },
          { Parameter: 'Benutzername', Wert: 'fahrschulpro' },
          { Parameter: 'Passwort', Wert: 'kwYpL0B2kOSJs7MCgkxUDao5mw3f' },
        ],
      },
    ],
  },
  {
    title: '⚙️ Backend-Umgebungsvariablen',
    subsections: [
      {
        subtitle: 'Helferchen Backend (.env: /opt/helferchen/apps/backend/.env)',
        rows: [
          { Variable: 'JWT_SECRET', Wert: 'd9e55fe867da66464d8a1a2a5a1b69e89e44a14d5ca978553967337b93c6f12c175e5429c82084981bcc4a5ac7aaf7c46dcb0019cc316f2700013dfb25b30d36' },
          { Variable: 'CRON_SECRET', Wert: 'W^qPbN&&cZ%tsOyA3ctEIGnrAQi42W48' },
          { Variable: 'TELEGRAM_BOT_TOKEN', Wert: '8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac' },
          { Variable: 'SMTP_USER', Wert: 'no-reply@helferchen.info' },
          { Variable: 'SMTP_PASS', Wert: 'jl2rz3#vhCXnVClEUW*Wge&J' },
        ],
      },
      {
        subtitle: 'Fahrschulpro Backend (.env: /opt/fahrschulpro/.env)',
        rows: [
          { Variable: 'DB_PASSWORD', Wert: 'FahrSchulPro2026!' },
          { Variable: 'SECRET_KEY', Wert: 'fcbfc426653401d7e965ab0f3bb07747d2566e8f25a2899efdae1cf344f6ba11' },
        ],
      },
    ],
  },
  {
    title: '🌐 Externe Zugänge & Dienste',
    rows: [
      { Dienst: 'INWX (Domain)', URL: 'https://www.inwx.de', Benutzername: 'berlinbear030', Passwort: '29913041Ma!?' },
      { Dienst: 'Froxlor (Hosting)', URL: 'https://prod0.webspace.bz', Benutzername: 'kd250524', Passwort: '29913041Ma!?' },
      { Dienst: 'FTP Webspace', Host: 'ftp.webspace.bz', Benutzername: 'kd250524ftp1', Passwort: 'Helferchen2026!' },
      { Dienst: 'Dogado VPS-Panel', URL: 'https://onehome.dogado.de/servers/771117/setup', Benutzername: '—', Passwort: '(manuell ändern)' },
      { Dienst: 'n8n (Workflows)', URL: 'https://n8n.helferchen.info', Benutzername: 'fabian', Passwort: 'Kj8#mW4$pLqR9@xZ' },
      { Dienst: 'Webmail (SnappyMail)', URL: 'https://helferchen.info/webmail', Benutzername: '—', Passwort: '(E-Mail-Passwort)' },
    ],
  },
  {
    title: '📋 Noch manuell zu erledigen',
    noteOnly: true,
    items: [
      '**dogado.de Panel:** Login unter https://my.dogado.de – Passwort manuell ändern',
      '**INWX DNS:** Login unter https://www.inwx.de – Passwort manuell ändern',
      '**Fahrschulpro App:** Falls Nutzer existieren, Passwörter ebenfalls ändern',
      '**Telegram Bot:** Falls Token kompromittiert → neuen Bot bei @BotFather erstellen',
      '**Spamhaus Delisting:** IP-Rehabilitation unter https://www.spamhaus.org/lookup/ beantragen',
      '**2FA:** Für dogado-Panel und INWX 2-Faktor-Authentifizierung aktivieren',
    ],
  },
];

function renderCredentials() {
  const main = document.getElementById('cred-content');
  let html = '';

  for (const section of CREDENTIAL_SECTIONS) {
    html += \`<div class="section-block"><div class="section-header">\${esc(section.title)}</div>\`;

    if (section.note) {
      html += \`<div class="note-block">\${esc(section.note)}</div>\`;
    }

    if (section.noteOnly && section.items) {
      html += '<div class="note-block info"><ul style="padding-left:18px">';
      for (const item of section.items) {
        const rendered = item.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        html += \`<li style="margin:4px 0">\${rendered}</li>\`;
      }
      html += '</ul></div>';
    }

    if (section.rows) {
      html += buildTable(section.rows);
    }

    if (section.subsections) {
      for (const sub of section.subsections) {
        html += \`<div class="subsection-header">\${esc(sub.subtitle)}</div>\`;
        html += buildTable(sub.rows);
      }
    }

    html += '</div>';
  }

  main.innerHTML = html;
  attachTableHandlers(main);
}

function buildTable(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const secretKeys = new Set(headers.filter(h => /pass|passwort|token|secret|key|wert/i.test(h)));

  let html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px"><table class="cred-table"><thead><tr>';
  for (const h of headers) html += \`<th>\${esc(h)}</th>\`;
  html += '<th style="width:80px"></th></thead><tbody>';

  for (const row of rows) {
    html += '<tr>';
    for (const [k, v] of Object.entries(row)) {
      const secret = secretKeys.has(k);
      html += \`<td><span class="val\${secret ? ' secret' : ''}" \${secret ? 'title="Klicken zum Anzeigen"' : ''}>\${esc(v || '—')}</span></td>\`;
    }
    const copyVal = Object.values(row).join(' | ');
    html += \`<td><button class="copy-btn" data-val="\${esc(copyVal)}">Kopieren</button></td>\`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function attachTableHandlers(root) {
  root.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.val, btn));
  });
  root.querySelectorAll('.val.secret').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('revealed'));
  });
}

// ===== INIT =====
async function init() {
  const loading = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  const authed = await checkAuth().catch(() => false);

  loading.style.display = 'none';

  if (authed) {
    appScreen.style.display = 'block';
    renderCredentials();
    document.getElementById('last-updated').textContent = 'Stand: 01.07.2026';
  } else {
    loginScreen.style.display = 'flex';
  }
}

// Login handler
document.getElementById('login-btn').addEventListener('click', async () => {
  const pw = document.getElementById('pw-input').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';

  const ok = await login(pw);
  if (ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    renderCredentials();
    document.getElementById('last-updated').textContent = 'Stand: 01.07.2026';
  } else {
    err.style.display = 'block';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
});

document.getElementById('pw-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('logout-btn').addEventListener('click', logout);

init();
</script>
</body>
</html>`;
}

createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔐 Helferchen Dashboard läuft auf:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://0.0.0.0:${PORT} (Netzwerk)\n`);
  console.log(`   Passwort: ${DASHBOARD_PASSWORD}\n`);
});
