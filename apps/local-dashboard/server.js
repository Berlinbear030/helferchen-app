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

// Credentials/access data per project (extracted from documentation)
const CREDENTIALS = {
  '694b9b83-22d9-4b83-bf82-5f1b8c2bfa56': [
    { label: 'Server IP', value: '85.190.98.5', type: 'ip' },
    { label: 'Domain', value: 'helferchen.info', type: 'url' },
    { label: 'SSH Benutzer', value: 'root', type: 'text' },
    { label: 'SSH Befehl', value: 'ssh root@85.190.98.5', type: 'command' },
    { label: 'SFTP Host', value: '85.190.98.5', type: 'ip' },
    { label: 'SFTP Port', value: '22', type: 'text' },
    { label: 'SFTP Benutzer', value: 'root', type: 'text' },
    { label: 'Backend Port', value: '3001', type: 'port' },
    { label: 'Datenbank', value: 'MySQL', type: 'text' },
    { label: 'DB Config', value: '/opt/helferchen/apps/backend/.env', type: 'path' },
    { label: 'Frontend Pfad', value: '/var/www/helferchen/', type: 'path' },
    { label: 'Backend Pfad', value: '/opt/helferchen/apps/backend/', type: 'path' },
    { label: 'Repo Pfad', value: '/opt/helferchen/', type: 'path' },
    { label: 'Admin Login', value: 'admin', type: 'text' },
    { label: 'Admin Passwort', value: 'admin123', type: 'password' },
    { label: 'Mitarbeiter Login', value: 'employee1', type: 'text' },
    { label: 'Mitarbeiter Passwort', value: 'employee123', type: 'password' },
    { label: 'PM2 Neustart', value: 'pm2 restart helferchen-backend', type: 'command' },
    { label: 'PM2 Logs', value: 'pm2 logs helferchen-api', type: 'command' },
    { label: 'Nginx Konfiguration', value: '/etc/nginx/sites-available/helferchen', type: 'path' },
  ],
  '7f11f7bc-7262-4e39-901d-451a1a19d207': [
    { label: 'JARVIS Verzeichnis', value: '/home/fabian/jarvis/', type: 'path' },
    { label: 'Bot starten', value: 'python3 /home/fabian/jarvis/bot.py', type: 'command' },
    { label: 'Wissen Verzeichnis', value: '/home/fabian/jarvis/wissen/', type: 'path' },
    { label: 'Ollama Host', value: '127.0.0.1:11434', type: 'url' },
    { label: 'Bevorzugtes Coding-Modell', value: 'qwen2.5-coder:7b', type: 'text' },
    { label: 'Bevorzugtes Reasoning-Modell', value: 'llama3.2:3b', type: 'text' },
  ],
  'global': [
    { label: 'Paperclip API', value: '127.0.0.1:3100', type: 'url' },
    { label: 'Ollama API', value: '127.0.0.1:11434', type: 'url' },
    { label: 'Agent Modell wechseln', value: './switch_agent_model.sh <agent_id> <tier>', type: 'command' },
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
    url.searchParams.set('limit', '50');
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
