import express from 'express';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5555;

// === AUTH ===
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '29913041';
const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

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
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  if (isValidSession(getToken(req))) return next();
  res.status(401).json({ error: 'Nicht angemeldet' });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/login', (req, res) => {
  if (req.body.password === DASHBOARD_PASSWORD) {
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

app.get('/api/credentials', requireAuth, (req, res) => {
  const file = join(__dirname, 'passwords.md');
  if (!existsSync(file)) return res.status(404).json({ error: 'passwords.md nicht gefunden' });
  const raw = readFileSync(file, 'utf-8');
  res.json({ html: marked.parse(raw), raw });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.send(buildHtml());
});

// ===================================================================
// HTML
// ===================================================================
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
      --primary: #00454A; --primary-light: #006d74;
      --accent: #FFB300;
      --bg: #0f1117; --bg-card: #1a1d24; --bg-hover: #22262f;
      --border: #2d3240;
      --text: #e8ecf0; --text-muted: #8892a0;
      --success: #10B981; --error: #EF4444; --warning: #F59E0B;
      --sidebar-w: 220px;
    }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

    /* ===== LOADING ===== */
    #loading-screen {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; color: var(--text-muted); gap: 10px; font-size: 14px;
    }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%; animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ===== LOGIN ===== */
    #login-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 14px; padding: 40px 36px; width: 100%; max-width: 380px; text-align: center;
    }
    .login-card .logo { font-size: 42px; margin-bottom: 12px; }
    .login-card h1 { font-size: 20px; color: var(--accent); margin-bottom: 6px; }
    .login-card p { font-size: 13px; color: var(--text-muted); margin-bottom: 28px; }
    .login-input {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text); padding: 12px 14px;
      font-size: 15px; outline: none; margin-bottom: 14px; letter-spacing: .05em;
    }
    .login-input:focus { border-color: var(--primary-light); }
    .login-btn {
      width: 100%; background: var(--primary); border: none; border-radius: 8px;
      color: white; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;
    }
    .login-btn:hover { background: var(--primary-light); }
    .login-error { color: var(--error); font-size: 13px; margin-top: 10px; display: none; }

    /* ===== APP LAYOUT ===== */
    #app-screen { display: none; height: 100vh; flex-direction: column; }

    /* ===== TOPBAR ===== */
    #topbar {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-card); border-bottom: 1px solid var(--border);
      padding: 12px 20px; flex-shrink: 0; position: sticky; top: 0; z-index: 100;
    }
    #topbar h1 { font-size: 16px; font-weight: 700; color: var(--accent); }

    /* ===== SEARCH ===== */
    #search-wrap { flex: 1; max-width: 400px; position: relative; }
    #search-input {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; color: var(--text); padding: 7px 32px 7px 12px;
      font-size: 13px; outline: none;
    }
    #search-input:focus { border-color: var(--primary-light); }
    #search-clear {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 14px; display: none;
    }
    #search-count { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

    .logout-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text-muted); padding: 6px 14px; font-size: 12px; cursor: pointer; margin-left: auto;
    }
    .logout-btn:hover { background: var(--bg-hover); color: var(--text); }

    /* ===== BODY SPLIT ===== */
    #body-split { display: flex; flex: 1; overflow: hidden; }

    /* ===== SIDEBAR ===== */
    #sidebar {
      width: var(--sidebar-w); min-width: var(--sidebar-w);
      background: var(--bg-card); border-right: 1px solid var(--border);
      overflow-y: auto; flex-shrink: 0;
      padding: 12px 0;
    }
    .sidebar-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      color: var(--text-muted); padding: 8px 16px 4px;
    }
    .proj-btn {
      display: flex; align-items: center; gap: 10px;
      width: 100%; background: none; border: none; border-left: 3px solid transparent;
      color: var(--text); padding: 10px 14px; font-size: 14px; cursor: pointer;
      text-align: left; transition: background .12s;
    }
    .proj-btn:hover { background: var(--bg-hover); }
    .proj-btn.active { background: var(--bg-hover); border-left-color: var(--accent); color: var(--accent); font-weight: 600; }
    .proj-btn .icon { font-size: 16px; width: 20px; text-align: center; }

    /* ===== MAIN CONTENT ===== */
    #main-content { flex: 1; overflow-y: auto; padding: 24px; }

    /* ===== SECTION BLOCKS ===== */
    .section-block { margin-bottom: 28px; }
    .section-block.hidden { display: none; }

    .section-header {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--accent);
      margin-bottom: 10px; padding-bottom: 7px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px;
    }
    .subsection-header {
      font-size: 12px; font-weight: 600; color: var(--primary-light);
      margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .05em;
    }

    /* ===== TABLE ===== */
    .tbl-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
    .cred-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cred-table th {
      background: var(--bg); padding: 8px 12px; text-align: left;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .05em;
    }
    .cred-table td { padding: 9px 12px; border-top: 1px solid var(--border); vertical-align: middle; }
    .cred-table tr:hover td { background: var(--bg-hover); }
    .cred-table tr.row-hidden { display: none; }

    .val { font-family: 'Cascadia Code','JetBrains Mono','Fira Code',monospace; color: var(--text); word-break: break-all; }
    .val.secret { filter: blur(5px); transition: filter .2s; cursor: pointer; }
    .val.secret.revealed { filter: none; }

    mark.hl { background: #fbbf24; color: #111; border-radius: 2px; padding: 0 2px; }

    .copy-btn {
      background: none; border: 1px solid var(--border); border-radius: 5px;
      color: var(--text-muted); padding: 3px 9px; font-size: 11px; cursor: pointer; white-space: nowrap;
    }
    .copy-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
    .copy-btn.copied { background: var(--success); color: white; border-color: var(--success); }

    /* ===== NOTE ===== */
    .note-block {
      background: var(--bg-card); border: 1px solid var(--border);
      border-left: 3px solid var(--warning);
      border-radius: 7px; padding: 10px 14px; font-size: 13px;
      color: var(--text-muted); margin-bottom: 12px; line-height: 1.6;
    }
    .note-block.info { border-left-color: var(--primary-light); }

    /* ===== EMPTY SEARCH ===== */
    #no-results { display: none; text-align: center; color: var(--text-muted); padding: 40px; font-size: 14px; }

    /* ===== TOAST ===== */
    #toast {
      position: fixed; bottom: 24px; right: 24px;
      background: var(--success); color: white; padding: 10px 18px;
      border-radius: 8px; font-size: 13px; font-weight: 600;
      opacity: 0; transform: translateY(8px); transition: all .2s;
      pointer-events: none; z-index: 9999;
    }
    #toast.show { opacity: 1; transform: none; }
  </style>
</head>
<body>

<div id="loading-screen"><div class="spinner"></div> Wird geladen…</div>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-card">
    <div class="logo">🔐</div>
    <h1>Helferchen Dashboard</h1>
    <p>Passwort eingeben, um fortzufahren</p>
    <input type="password" id="pw-input" class="login-input" placeholder="Passwort" autocomplete="current-password" />
    <button class="login-btn" id="login-btn">Anmelden</button>
    <div class="login-error" id="login-error">Falsches Passwort</div>
  </div>
</div>

<!-- APP -->
<div id="app-screen">

  <!-- TOPBAR -->
  <div id="topbar">
    <span style="font-size:20px">🏠</span>
    <h1>Helferchen – Zugangsdaten</h1>
    <div id="search-wrap">
      <input type="text" id="search-input" placeholder="🔍  Suchen (z.B. root, SMTP, INWX…)" autocomplete="off" />
      <button id="search-clear">✕</button>
    </div>
    <span id="search-count"></span>
    <button class="logout-btn" id="logout-btn">Abmelden</button>
  </div>

  <div id="body-split">

    <!-- SIDEBAR -->
    <nav id="sidebar">
      <div class="sidebar-label">Projekte</div>
      <button class="proj-btn active" data-project="all"><span class="icon">📋</span>Alle</button>
      <button class="proj-btn" data-project="helferchen"><span class="icon">🏠</span>Helferchen</button>
      <button class="proj-btn" data-project="fahrschule"><span class="icon">🚗</span>Fahrschule Mama</button>
      <button class="proj-btn" data-project="global"><span class="icon">🌐</span>Externe Dienste</button>
      <button class="proj-btn" data-project="todo"><span class="icon">📋</span>Todo-Liste</button>
    </nav>

    <!-- CONTENT -->
    <div id="main-content">
      <div id="no-results">Keine Ergebnisse für diese Suche.</div>
    </div>

  </div>
</div>

<div id="toast">✓ Kopiert!</div>

<script>
// ===== UTILS =====
const toast = document.getElementById('toast');
let toastTimer;

function showToast() {
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const el = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
  }
  if (btn) {
    btn.textContent = '✓'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Kopieren'; btn.classList.remove('copied'); }, 1800);
  }
  showToast();
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== AUTH =====
async function login(pw) {
  const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({password: pw}) });
  return res.ok;
}

// ===== DATA (structured from passwords.md) =====
// Each section has: id, title, project, note?, rows? or subsections?, noteOnly?
const SECTIONS = [
  {
    id: 'server', title: '🖥️ VPS-Server (85.190.98.5)', project: 'helferchen',
    note: 'SSH-Schlüssel ist primär. Root-Passwort nur für Notfall.',
    rows: [
      { Dienst: 'SSH Root-Zugang', Host: 'root@85.190.98.5', Passwort: '38!UTVq!$dMhxi!DeSs1%990', Hinweis: 'Port 22' },
      { Dienst: 'Webmin Panel', Host: 'https://localhost:10000', Passwort: 'Wx9#mK2$pLqN7@vR4hT', Hinweis: 'SSH-Tunnel nötig' },
    ],
  },
  {
    id: 'email', title: '📧 E-Mail-Konten (helferchen.info)', project: 'helferchen',
    note: '⚠️ info@helferchen.info = kompromittiert (Phishing). Server: helferchen.info Port 587 STARTTLS',
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
    id: 'portal', title: '🔐 Helferchen-Portal Benutzer', project: 'helferchen',
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
    id: 'db-helferchen', title: '🗄️ Datenbank – Helferchen MySQL', project: 'helferchen',
    rows: [
      { Parameter: 'Host', Wert: 'localhost:3306' },
      { Parameter: 'Datenbank', Wert: 'helferchen' },
      { Parameter: 'Benutzername', Wert: 'helferchen' },
      { Parameter: 'Passwort', Wert: 'LF!zb$V1&rcgLq065$&uDuM8' },
    ],
  },
  {
    id: 'env-helferchen', title: '⚙️ Backend .env – Helferchen', project: 'helferchen',
    note: 'Pfad auf Server: /opt/helferchen/apps/backend/.env',
    rows: [
      { Variable: 'JWT_SECRET', Wert: 'd9e55fe867da66464d8a1a2a5a1b69e89e44a14d5ca978553967337b93c6f12c175e5429c82084981bcc4a5ac7aaf7c46dcb0019cc316f2700013dfb25b30d36' },
      { Variable: 'CRON_SECRET', Wert: 'W^qPbN&&cZ%tsOyA3ctEIGnrAQi42W48' },
      { Variable: 'TELEGRAM_BOT_TOKEN', Wert: '8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac' },
      { Variable: 'SMTP_USER', Wert: 'no-reply@helferchen.info' },
      { Variable: 'SMTP_PASS', Wert: 'jl2rz3#vhCXnVClEUW*Wge&J' },
    ],
  },
  {
    id: 'db-fahrschule', title: '🗄️ Datenbank – Fahrschulpro PostgreSQL', project: 'fahrschule',
    note: 'Docker-Container. Nur intern erreichbar (127.0.0.1:5434)',
    rows: [
      { Parameter: 'Host', Wert: 'localhost:5434' },
      { Parameter: 'Datenbank', Wert: 'fahrschulpro' },
      { Parameter: 'Benutzername', Wert: 'fahrschulpro' },
      { Parameter: 'Passwort', Wert: 'kwYpL0B2kOSJs7MCgkxUDao5mw3f' },
    ],
  },
  {
    id: 'env-fahrschule', title: '⚙️ Backend .env – Fahrschulpro', project: 'fahrschule',
    note: 'Pfad auf Server: /opt/fahrschulpro/.env',
    rows: [
      { Variable: 'DB_PASSWORD', Wert: 'FahrSchulPro2026!' },
      { Variable: 'SECRET_KEY', Wert: 'fcbfc426653401d7e965ab0f3bb07747d2566e8f25a2899efdae1cf344f6ba11' },
      { Variable: 'BASE_URL', Wert: 'https://fahrschulpro.helferchen.info' },
    ],
  },
  {
    id: 'external', title: '🌐 Externe Dienste & Zugänge', project: 'global',
    rows: [
      { Dienst: 'INWX (Domain)', URL: 'https://www.inwx.de', Benutzername: 'berlinbear030', Passwort: '29913041Ma!?' },
      { Dienst: 'Froxlor (Hosting-Panel)', URL: 'https://prod0.webspace.bz', Benutzername: 'kd250524', Passwort: '29913041Ma!?' },
      { Dienst: 'FTP Webspace', Host: 'ftp.webspace.bz', Benutzername: 'kd250524ftp1', Passwort: 'Helferchen2026!' },
      { Dienst: 'Dogado VPS-Panel', URL: 'https://onehome.dogado.de/servers/771117/setup', Benutzername: '—', Passwort: '(manuell setzen)' },
      { Dienst: 'n8n (Workflows)', URL: 'https://n8n.helferchen.info', Benutzername: 'fabian', Passwort: 'Kj8#mW4$pLqR9@xZ' },
      { Dienst: 'Webmail (SnappyMail)', URL: 'https://helferchen.info/webmail', Benutzername: '—', Passwort: '(E-Mail-Passwort)' },
    ],
  },
  {
    id: 'todo', title: '📋 Noch manuell zu erledigen', project: 'todo',
    noteOnly: true,
    items: [
      '<strong>dogado.de Panel</strong> → https://my.dogado.de – Passwort manuell ändern',
      '<strong>INWX DNS</strong> → https://www.inwx.de – 2FA aktivieren',
      '<strong>Fahrschulpro App</strong> – Falls Nutzer existieren, Passwörter ändern',
      '<strong>Telegram Bot</strong> – Falls Token kompromittiert → @BotFather neuen Bot erstellen',
      '<strong>Spamhaus Delisting</strong> → https://www.spamhaus.org/lookup/',
      '<strong>2FA</strong> – Für dogado-Panel und INWX aktivieren',
    ],
  },
];

// ===== SECRET DETECTION =====
const SECRET_KEYS = /passwort|password|token|secret|pass|wert|pwd/i;

// ===== RENDER ALL SECTIONS =====
function renderAll() {
  const main = document.getElementById('main-content');
  const noResults = document.getElementById('no-results');

  // Remove old section blocks (keep no-results)
  main.querySelectorAll('.section-block').forEach(el => el.remove());

  for (const sec of SECTIONS) {
    const block = document.createElement('div');
    block.className = 'section-block';
    block.dataset.project = sec.project;
    block.dataset.id = sec.id;
    block.innerHTML = buildSection(sec);
    main.insertBefore(block, noResults);
  }

  attachHandlers();
}

function buildSection(sec) {
  let html = \`<div class="section-header">\${esc(sec.title)}</div>\`;

  if (sec.note) {
    html += \`<div class="note-block">\${esc(sec.note)}</div>\`;
  }

  if (sec.noteOnly && sec.items) {
    html += '<div class="note-block info"><ul style="padding-left:18px">';
    for (const item of sec.items) {
      html += \`<li style="margin:5px 0">\${item}</li>\`;
    }
    html += '</ul></div>';
  }

  if (sec.rows) {
    html += buildTable(sec.rows, sec.id);
  }

  return html;
}

function buildTable(rows, secId) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  let html = \`<div class="tbl-wrap"><table class="cred-table"><thead><tr>\`;
  for (const h of headers) html += \`<th>\${esc(h)}</th>\`;
  html += '<th></th></tr></thead><tbody>';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    html += \`<tr data-row-idx="\${i}" data-sec-id="\${esc(secId)}">\`;
    for (const [k, v] of Object.entries(row)) {
      const secret = SECRET_KEYS.test(k);
      html += \`<td><span class="val\${secret ? ' secret' : ''}" data-plain="\${esc(v||'')}">\${esc(v || '—')}</span></td>\`;
    }
    const copyVal = Object.values(row).join(' | ');
    html += \`<td><button class="copy-btn" data-val="\${esc(copyVal)}">Kopieren</button></td>\`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function attachHandlers() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.val, btn));
  });
  document.querySelectorAll('.val.secret').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('revealed'));
  });
}

// ===== PROJECT FILTER =====
let activeProject = 'all';
let searchQuery = '';

function applyFilters() {
  const q = searchQuery.toLowerCase().trim();
  const blocks = document.querySelectorAll('.section-block');
  let totalVisible = 0;
  let totalRows = 0;
  let matchRows = 0;

  blocks.forEach(block => {
    const proj = block.dataset.project;
    const matchProj = activeProject === 'all' || proj === activeProject;

    if (!matchProj) { block.classList.add('hidden'); return; }
    block.classList.remove('hidden');

    if (!q) {
      // No search – show all rows
      block.querySelectorAll('tr[data-row-idx]').forEach(row => {
        row.classList.remove('row-hidden');
        // Remove highlights
        row.querySelectorAll('.val[data-plain]').forEach(el => { el.innerHTML = esc(el.dataset.plain || ''); });
      });
      block.querySelectorAll('.note-block').forEach(n => n.style.display = '');
      totalVisible++;
      return;
    }

    // Search mode
    let blockHasMatch = false;

    block.querySelectorAll('tr[data-row-idx]').forEach(row => {
      totalRows++;
      const allText = Array.from(row.querySelectorAll('.val')).map(el => el.dataset.plain || '').join(' ').toLowerCase();
      if (allText.includes(q)) {
        row.classList.remove('row-hidden');
        matchRows++;
        blockHasMatch = true;
        // Highlight
        row.querySelectorAll('.val[data-plain]').forEach(el => {
          const plain = el.dataset.plain || '';
          el.innerHTML = highlight(plain, q);
        });
      } else {
        row.classList.add('row-hidden');
        row.querySelectorAll('.val[data-plain]').forEach(el => { el.innerHTML = esc(el.dataset.plain || ''); });
      }
    });

    // Also search section title and note
    const titleMatch = block.querySelector('.section-header')?.textContent.toLowerCase().includes(q);
    if (titleMatch && !blockHasMatch) {
      block.querySelectorAll('tr[data-row-idx]').forEach(row => { row.classList.remove('row-hidden'); matchRows++; blockHasMatch = true; });
    }

    // Note blocks: always show in section if section is visible
    block.querySelectorAll('.note-block').forEach(n => {
      n.style.display = blockHasMatch ? '' : 'none';
    });

    if (!blockHasMatch && block.querySelector('.tbl-wrap')) {
      block.classList.add('hidden');
    } else if (blockHasMatch) {
      totalVisible++;
    }
  });

  // Update count
  const countEl = document.getElementById('search-count');
  if (q) {
    countEl.textContent = matchRows > 0 ? \`\${matchRows} Ergebnis\${matchRows !== 1 ? 'se' : ''}\` : '';
  } else {
    countEl.textContent = '';
  }

  document.getElementById('no-results').style.display = (q && matchRows === 0) ? 'block' : 'none';
}

function highlight(text, q) {
  if (!q) return esc(text);
  const escaped = esc(text);
  const escapedQ = q.replace(/[.*+?^{}()|[\\]\\\\$]/g, '\\\\$&');
  return escaped.replace(new RegExp(escapedQ, 'gi'), m => \`<mark class="hl">\${m}</mark>\`);
}

// ===== INIT =====
async function init() {
  const loading = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  let authed = false;
  try {
    const r = await fetch('/api/auth-check');
    authed = (await r.json()).authenticated;
  } catch {}

  loading.style.display = 'none';

  if (authed) {
    showApp(appScreen);
  } else {
    loginScreen.style.display = 'flex';
  }
}

function showApp(appScreen) {
  appScreen.style.display = 'flex';
  renderAll();
  applyFilters();
  wireApp();
}

function wireApp() {
  // Sidebar project buttons
  document.querySelectorAll('.proj-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.proj-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeProject = btn.dataset.project;
      applyFilters();
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    clearBtn.style.display = searchQuery ? 'block' : 'none';
    applyFilters();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    applyFilters();
    searchInput.focus();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  });
}

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const pw = document.getElementById('pw-input').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  const ok = await login(pw);
  if (ok) {
    document.getElementById('login-screen').style.display = 'none';
    showApp(document.getElementById('app-screen'));
  } else {
    err.style.display = 'block';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
});
document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-btn').click(); });

init();
</script>
</body>
</html>`;
}

createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔐 Helferchen Dashboard:`);
  console.log(`   http://localhost:${PORT}  |  http://192.168.100.2:${PORT}`);
  console.log(`   Passwort: ${DASHBOARD_PASSWORD}\n`);
});
