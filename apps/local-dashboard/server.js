import express from 'express';
import { createServer } from 'http';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { marked } from 'marked';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5555;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Project base directory
const PROJECTS_BASE = '/media/fabian/m2Festplatte/ausgelagert/.paperclip/instances/default/projects/1a748860-f520-4bca-83a6-3bd4e7d1e831';

const PROJECTS = [
  {
    id: '694b9b83-22d9-4b83-bf82-5f1b8c2bfa56',
    name: 'Helferchen',
    description: 'Haushalts-Plattform für Senioren (helferchen.info)',
    icon: '🏠',
    color: '#00454A',
    path: join(PROJECTS_BASE, '694b9b83-22d9-4b83-bf82-5f1b8c2bfa56/_default'),
  },
  {
    id: 'dee9ea35-9695-47b8-99da-52f25a0f7bb7',
    name: 'Onboarding',
    description: 'Unternehmensonboarding und Setup',
    icon: '🚀',
    color: '#1d4ed8',
    path: join(PROJECTS_BASE, 'dee9ea35-9695-47b8-99da-52f25a0f7bb7/_default'),
  },
  {
    id: '7f11f7bc-7262-4e39-901d-451a1a19d207',
    name: 'JARVIS – Local',
    description: 'Lokaler KI-Assistent',
    icon: '🤖',
    color: '#7c3aed',
    path: join(PROJECTS_BASE, '7f11f7bc-7262-4e39-901d-451a1a19d207/_default'),
  },
  {
    id: '2e4dfab4-ed4a-4df7-8cb5-fd75c01467aa',
    name: 'Fahrschule Mama',
    description: 'Fahrschul-Management-System',
    icon: '🚗',
    color: '#b45309',
    path: join(PROJECTS_BASE, '2e4dfab4-ed4a-4df7-8cb5-fd75c01467aa/_default'),
  },
  {
    id: '9e37dead-9397-478c-83f8-8acaef1615f0',
    name: 'Überwachungs-Dashboard',
    description: 'Monitoring und Infrastruktur-Überwachung',
    icon: '📊',
    color: '#059669',
    path: join(PROJECTS_BASE, '9e37dead-9397-478c-83f8-8acaef1615f0/_default'),
  },
  {
    id: '2eedb4e4-a4be-47d9-a416-503a81bdba24',
    name: 'Sprachmodelle AI',
    description: 'KI und Sprachmodell-Projekte',
    icon: '🧠',
    color: '#db2777',
    path: join(PROJECTS_BASE, '2eedb4e4-a4be-47d9-a416-503a81bdba24/_default'),
  },
];

// Credentials/access data per project (extracted from documentation and .env files)
const CREDENTIALS = {
  '694b9b83-22d9-4b83-bf82-5f1b8c2bfa56': [
    // === SERVER / SSH / SFTP ===
    { group: 'Server & SSH', label: 'Server IP', value: '85.190.98.5', type: 'ip' },
    { group: 'Server & SSH', label: 'Domain', value: 'helferchen.info', type: 'url' },
    { group: 'Server & SSH', label: 'SSH Benutzer', value: 'root', type: 'text' },
    { group: 'Server & SSH', label: 'SSH Befehl', value: 'ssh root@85.190.98.5', type: 'command' },
    { group: 'Server & SSH', label: 'SFTP Host', value: '85.190.98.5', type: 'ip' },
    { group: 'Server & SSH', label: 'SFTP Benutzer', value: 'root', type: 'text' },
    { group: 'Server & SSH', label: 'SFTP Port', value: '22', type: 'text' },
    // === SERVER-PFADE ===
    { group: 'Server-Pfade', label: 'Frontend Pfad', value: '/var/www/helferchen/', type: 'path' },
    { group: 'Server-Pfade', label: 'Backend Pfad', value: '/opt/helferchen/apps/backend/', type: 'path' },
    { group: 'Server-Pfade', label: 'Repo Pfad', value: '/opt/helferchen/', type: 'path' },
    { group: 'Server-Pfade', label: 'Nginx Config', value: '/etc/nginx/sites-available/helferchen', type: 'path' },
    { group: 'Server-Pfade', label: '.env Pfad', value: '/opt/helferchen/apps/backend/.env', type: 'path' },
    // === DATENBANK ===
    { group: 'MySQL Datenbank', label: 'DB Name', value: 'helferchen', type: 'text' },
    { group: 'MySQL Datenbank', label: 'DB Benutzer', value: 'helferchen', type: 'text' },
    { group: 'MySQL Datenbank', label: 'DB Passwort', value: 'LF!zb$V1&rcgLq065$&uDuM8', type: 'password' },
    { group: 'MySQL Datenbank', label: 'DB Host', value: 'localhost:3306', type: 'text' },
    { group: 'MySQL Datenbank', label: 'DB URL', value: 'mysql://helferchen:LF!zb$V1&rcgLq065$&uDuM8@localhost:3306/helferchen', type: 'password' },
    // === APP-LOGINS ===
    { group: 'App-Logins (helferchen.info)', label: 'Admin – Benutzername', value: 'admin', type: 'text' },
    { group: 'App-Logins (helferchen.info)', label: 'Admin – Passwort', value: 'admin123', type: 'password' },
    { group: 'App-Logins (helferchen.info)', label: 'Board – Benutzername', value: 'board', type: 'text' },
    { group: 'App-Logins (helferchen.info)', label: 'Board – Passwort', value: 'board2026', type: 'password' },
    { group: 'App-Logins (helferchen.info)', label: 'Mitarbeiter – Benutzername', value: 'employee1', type: 'text' },
    { group: 'App-Logins (helferchen.info)', label: 'Mitarbeiter – Passwort', value: 'employee123', type: 'password' },
    // === E-MAIL / SMTP ===
    { group: 'E-Mail / SMTP', label: 'SMTP Host', value: 'helferchen.info', type: 'text' },
    { group: 'E-Mail / SMTP', label: 'SMTP Port', value: '587', type: 'port' },
    { group: 'E-Mail / SMTP', label: 'SMTP Benutzer', value: 'no-reply@helferchen.info', type: 'text' },
    { group: 'E-Mail / SMTP', label: 'SMTP Passwort', value: 'jl2rz3#vhCXnVClEUW*Wge&J', type: 'password' },
    { group: 'E-Mail / SMTP', label: 'Admin E-Mail', value: 'info@helferchen.info', type: 'text' },
    // === TELEGRAM ===
    { group: 'Telegram Bot', label: 'Bot Token', value: '8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac', type: 'password' },
    // === SECRETS ===
    { group: 'App-Secrets', label: 'JWT Secret', value: 'd9e55fe867da66464d8a1a2a5a1b69e89e44a14d5ca978553967337b93c6f12c175e5429c82084981bcc4a5ac7aaf7c46dcb0019cc316f2700013dfb25b30d36', type: 'password' },
    { group: 'App-Secrets', label: 'Cron Secret', value: 'W^qPbN&&cZ%tsOyA3ctEIGnrAQi42W48', type: 'password' },
    // === PM2 BEFEHLE ===
    { group: 'PM2 Befehle', label: 'Backend neu starten', value: 'pm2 restart helferchen-backend', type: 'command' },
    { group: 'PM2 Befehle', label: 'Backend Logs', value: 'pm2 logs helferchen-api', type: 'command' },
    { group: 'PM2 Befehle', label: 'Status anzeigen', value: 'pm2 status', type: 'command' },
  ],
  '2e4dfab4-ed4a-4df7-8cb5-fd75c01467aa': [
    { group: 'Server', label: 'Domain', value: 'fahrschulpro.helferchen.info', type: 'url' },
    { group: 'Server', label: 'Server IP', value: '85.190.98.5', type: 'ip' },
    { group: 'Server', label: 'Port', value: '8080', type: 'port' },
    { group: 'Datenbank', label: 'DB Passwort', value: 'FahrSchulPro2026!', type: 'password' },
    { group: 'App-Secrets', label: 'Secret Key', value: 'fcbfc426653401d7e965ab0f3bb07747d2566e8f25a2899efdae1cf344f6ba11', type: 'password' },
    { group: 'App-Secrets', label: 'Umgebung', value: 'production', type: 'text' },
  ],
  '7f11f7bc-7262-4e39-901d-451a1a19d207': [
    { group: 'JARVIS', label: 'JARVIS Verzeichnis', value: '/home/fabian/jarvis/', type: 'path' },
    { group: 'JARVIS', label: 'Bot starten', value: 'python3 /home/fabian/jarvis/bot.py', type: 'command' },
    { group: 'JARVIS', label: 'Wissen Verzeichnis', value: '/home/fabian/jarvis/wissen/', type: 'path' },
    { group: 'Ollama / KI-Modelle', label: 'Ollama Host', value: '127.0.0.1:11434', type: 'url' },
    { group: 'Ollama / KI-Modelle', label: 'Coding-Modell', value: 'qwen2.5-coder:7b', type: 'text' },
    { group: 'Ollama / KI-Modelle', label: 'Reasoning-Modell', value: 'llama3.2:3b', type: 'text' },
  ],
  'global': [
    // === DOMAIN-REGISTRAR INWX ===
    { group: 'INWX (Domain-Registrar)', label: 'URL', value: 'https://www.inwx.de', type: 'url' },
    { group: 'INWX (Domain-Registrar)', label: 'Benutzername', value: 'berlinbear030', type: 'text' },
    { group: 'INWX (Domain-Registrar)', label: 'Passwort', value: '29913041Ma!?', type: 'password' },
    { group: 'INWX (Domain-Registrar)', label: 'API URL', value: 'https://api.domrobot.com/xmlrpc/', type: 'url' },
    // === FROXLOR HOSTING-PANEL ===
    { group: 'Froxlor (Hosting-Panel)', label: 'URL', value: 'https://prod0.webspace.bz', type: 'url' },
    { group: 'Froxlor (Hosting-Panel)', label: 'Benutzername', value: 'kd250524', type: 'text' },
    { group: 'Froxlor (Hosting-Panel)', label: 'Passwort', value: '29913041Ma!?', type: 'password' },
    // === FTP (WEBSPACE) ===
    { group: 'FTP (Webspace)', label: 'FTP Host', value: 'ftp.webspace.bz', type: 'text' },
    { group: 'FTP (Webspace)', label: 'FTP Benutzer', value: 'kd250524ftp1', type: 'text' },
    { group: 'FTP (Webspace)', label: 'FTP Passwort', value: 'Helferchen2026!', type: 'password' },
    // === DOGADO VPS-PANEL ===
    { group: 'Dogado VPS-Panel', label: 'URL', value: 'https://onehome.dogado.de/servers/771117/setup', type: 'url' },
    { group: 'Dogado VPS-Panel', label: 'Hinweis', value: 'Root-Passwort hier zurücksetzen', type: 'text' },
    // === LOKALE INFRASTRUKTUR ===
    { group: 'Lokale Infrastruktur', label: 'Paperclip API', value: 'http://127.0.0.1:3100', type: 'url' },
    { group: 'Lokale Infrastruktur', label: 'Ollama API', value: 'http://127.0.0.1:11434', type: 'url' },
    { group: 'Lokale Infrastruktur', label: 'Lokaler PC', value: 'root / 29913041', type: 'password' },
    { group: 'Lokale Infrastruktur', label: 'Agent Modell wechseln', value: './switch_agent_model.sh <agent_id> <tier>', type: 'command' },
  ],
};

function getDocFiles(projectPath) {
  if (!existsSync(projectPath)) return [];

  const ALLOWED_EXT = ['.md', '.txt'];
  const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.pytest_cache'];
  const docs = [];

  function scan(dir, depth = 0) {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDE_DIRS.includes(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        scan(full, depth + 1);
      } else if (ALLOWED_EXT.includes(extname(entry).toLowerCase())) {
        const rel = full.replace(projectPath + '/', '');
        docs.push({ name: basename(entry), path: rel, fullPath: full });
      }
    }
  }

  scan(projectPath);
  return docs;
}

// API: List all projects with their docs
app.get('/api/projects', (req, res) => {
  const result = PROJECTS.map((p) => {
    const docs = getDocFiles(p.path);
    const creds = CREDENTIALS[p.id] || [];
    return {
      ...p,
      docs: docs.slice(0, 50),
      credentialCount: creds.length,
      exists: existsSync(p.path),
    };
  });
  res.json(result);
});

// API: Get project credentials
app.get('/api/projects/:id/credentials', (req, res) => {
  const creds = CREDENTIALS[req.params.id] || [];
  const global = CREDENTIALS['global'] || [];
  res.json({ credentials: creds, global });
});

// API: Get a document content (rendered as HTML)
app.get('/api/docs', (req, res) => {
  const { path: docPath } = req.query;
  if (!docPath || typeof docPath !== 'string') {
    return res.status(400).json({ error: 'path required' });
  }
  // Security: only allow reading from known project paths
  const allowed = PROJECTS.map((p) => p.path);
  const isAllowed = allowed.some((base) => docPath.startsWith(base));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!existsSync(docPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const raw = readFileSync(docPath, 'utf-8');
    const html = marked.parse(raw);
    res.json({ raw, html });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// API: Get all Paperclip issues for a project
app.get('/api/paperclip/issues', async (req, res) => {
  const { projectId } = req.query;
  const apiUrl = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100';
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  if (!apiKey || !companyId) {
    return res.status(503).json({ error: 'Paperclip not configured' });
  }
  try {
    const url = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
    url.searchParams.set('limit', '100');
    if (projectId) url.searchParams.set('projectId', String(projectId));
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// API: Get issue with all comments (full documentation view)
app.get('/api/paperclip/issues/:issueId/full', async (req, res) => {
  const { issueId } = req.params;
  const apiUrl = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100';
  const apiKey = process.env.PAPERCLIP_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Paperclip not configured' });
  try {
    const [issueRes, commentsRes] = await Promise.all([
      fetch(`${apiUrl}/api/issues/${issueId}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
      fetch(`${apiUrl}/api/issues/${issueId}/comments`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    ]);
    const issue = await issueRes.json();
    const comments = await commentsRes.json();
    const agentComments = Array.isArray(comments)
      ? comments.filter((c) => c.authorAgentId && c.body && c.body.length > 50)
      : [];
    // Render markdown to HTML
    const descHtml = issue.description ? marked.parse(issue.description) : '';
    const commentsHtml = agentComments.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      bodyHtml: marked.parse(c.body || ''),
      body: c.body,
    }));
    res.json({ issue, descHtml, comments: commentsHtml });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// API: Search all issues across all projects (for the docs tab)
app.get('/api/paperclip/all-issues', async (req, res) => {
  const { q, projectId } = req.query;
  const apiUrl = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100';
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  if (!apiKey || !companyId) return res.status(503).json({ error: 'Paperclip not configured' });
  try {
    const url = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
    url.searchParams.set('limit', '200');
    if (q) url.searchParams.set('q', String(q));
    if (projectId) url.searchParams.set('projectId', String(projectId));
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await response.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// API: Get local server info
app.get('/api/system', (req, res) => {
  res.json({
    hostname: process.env.HOSTNAME || 'localhost',
    port: PORT,
    paperclipApi: process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100',
    ollamaApi: 'http://127.0.0.1:11434',
    helferchen: 'https://helferchen.info',
    serverAt: new Date().toISOString(),
  });
});

createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏠 Lokales Dashboard läuft auf:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://0.0.0.0:${PORT} (ganzes Netzwerk)\n`);
});
