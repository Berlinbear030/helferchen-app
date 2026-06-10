import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const API = '/api';

interface User { id: string; full_name: string; role: string; }
interface Customer { id: string; first_name: string; last_name: string; address: string; }
interface Assignment { id: string; title: string; description: string; scheduled_at: string; status: string; customer: Customer; assigned_user_id?: string; assigned_user?: { id: string; full_name: string } | null; }
interface Timelog { id: string; assignment_id: string; start_time: string; end_time: string | null; is_signed: boolean; }
interface DashboardStats {
  today_appointments: number; open_assignments: number; completed_today: number;
  daily_revenue: number; monthly_revenue: number; open_booking_requests: number;
  recent_assignments: Assignment[];
}
interface BookingRequest {
  id: string; name: string; phone: string; email: string;
  service_description: string; preferred_date: string; preferred_time: string;
  status: string; assigned_user_id: string | null; notes: string; created_at: string;
}

type Tab = 'dashboard' | 'appointments' | 'tour' | 'booking-requests' | 'timelogs' | 'employees' | 'assignments-admin';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Läuft…';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function statusLabel(s: string) {
  return ({ pending: 'Ausstehend', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen', cancelled: 'Abgebrochen' } as Record<string, string>)[s] || s;
}

// ── Dashboard Tab ──────────────────────────────────────────────────────────────

function DashboardTab({ user }: { user: User }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/dashboard/stats`, { headers: authHeaders() })
      .then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-text">Lade Dashboard…</div>;
  if (!stats) return <div className="error-banner">Dashboard konnte nicht geladen werden.</div>;

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="dashboard-tab">
      <div className="dashboard-greeting">
        <h2>Hallo, {user.full_name}!</h2>
        <p className="dashboard-date">{today}</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <span className="stat-value">{stats.today_appointments}</span>
          <span className="stat-label">Heutige Termine</span>
        </div>
        <div className="stat-card stat-success">
          <span className="stat-value">{stats.daily_revenue} €</span>
          <span className="stat-label">Tageseinnahmen</span>
        </div>
        <div className="stat-card stat-accent">
          <span className="stat-value">{stats.monthly_revenue} €</span>
          <span className="stat-label">Monatseinnahmen</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-value">{stats.open_assignments}</span>
          <span className="stat-label">Offene Aufträge</span>
        </div>
        {user.role === 'admin' && (
          <div className="stat-card stat-info">
            <span className="stat-value">{stats.open_booking_requests}</span>
            <span className="stat-label">Neue Buchungsanfragen</span>
          </div>
        )}
      </div>
      <h3 style={{ marginTop: 32, marginBottom: 12 }}>Aktuelle Aufträge</h3>
      {stats.recent_assignments.length === 0 ? (
        <p className="empty-state">Keine Aufträge vorhanden.</p>
      ) : (
        <div className="appointments-list">
          {stats.recent_assignments.slice(0, 5).map(a => (
            <div key={a.id} className={`appointment-card status-${a.status}`}>
              <div className="appointment-header">
                <strong>{a.title}</strong>
                <span className="status-badge">{statusLabel(a.status)}</span>
              </div>
              {a.customer && <p className="appointment-customer">{a.customer.first_name} {a.customer.last_name} — {a.customer.address}</p>}
              <p className="appointment-time">{new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appointments Tab ───────────────────────────────────────────────────────────

function AppointmentsTab({ assignments, onRefresh }: { assignments: Assignment[]; onRefresh: () => void }) {
  const handleStatus = async (id: string, status: string) => {
    await fetch(`${API}/assignments/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
    onRefresh();
  };
  return (
    <div className="appointments-list">
      {assignments.length === 0 && <p className="empty-state">Keine Termine zugewiesen.</p>}
      {assignments.map(a => (
        <div key={a.id} className={`appointment-card status-${a.status}`}>
          <div className="appointment-header">
            <strong>{a.title}</strong>
            <span className="status-badge">{statusLabel(a.status)}</span>
          </div>
          <p className="appointment-customer">{a.customer?.first_name} {a.customer?.last_name} — {a.customer?.address}</p>
          <p className="appointment-time">{new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {a.description && <p className="appointment-desc">{a.description}</p>}
          <div className="appointment-actions">
            {a.status === 'pending' && <button className="btn-primary" onClick={() => handleStatus(a.id, 'in_progress')}>Starten</button>}
            {a.status === 'in_progress' && <button className="btn-success" onClick={() => handleStatus(a.id, 'completed')}>Abschließen</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tour Planning Tab ──────────────────────────────────────────────────────────

function TourTab({ assignments }: { assignments: Assignment[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const dayAssignments = assignments
    .filter(a => a.scheduled_at.startsWith(selectedDate))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="tour-tab">
      <div className="tour-header">
        <h3>Tagesroute planen</h3>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="date-picker" />
      </div>
      {dayAssignments.length === 0 ? (
        <p className="empty-state">Keine Termine für diesen Tag.</p>
      ) : (
        <>
          <p className="tour-summary">{dayAssignments.length} Termin(e) · chronologische Reihenfolge</p>
          <div className="tour-route">
            {dayAssignments.map((a, i) => (
              <div key={a.id} className="tour-stop">
                <div className="tour-stop-num">{i + 1}</div>
                <div className="tour-stop-body">
                  <div className="tour-stop-time">{new Date(a.scheduled_at).toLocaleTimeString('de-DE', { timeStyle: 'short' })} Uhr</div>
                  <strong>{a.title}</strong>
                  {a.customer && (
                    <>
                      <p>{a.customer.first_name} {a.customer.last_name}</p>
                      <p className="tour-address">📍 {a.customer.address}</p>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(a.customer.address)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                        In Maps öffnen
                      </a>
                    </>
                  )}
                  <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Booking Requests Tab ───────────────────────────────────────────────────────

function BookingRequestsTab() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/booking-requests?status=${filter}`, { headers: authHeaders() });
      setRequests(await r.json());
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const update = async (id: string, body: object) => {
    await fetch(`${API}/booking-requests/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
    load();
  };

  const opts = [{ v: 'open', l: 'Offen' }, { v: 'accepted', l: 'Angenommen' }, { v: 'rejected', l: 'Abgelehnt' }, { v: 'assigned', l: 'Zugewiesen' }];

  return (
    <div className="booking-requests-tab">
      <div className="filter-row">
        {opts.map(o => <button key={o.v} className={`filter-btn ${filter === o.v ? 'active' : ''}`} onClick={() => setFilter(o.v)}>{o.l}</button>)}
      </div>
      {loading ? <div className="loading-text">Lade Anfragen…</div> : (
        requests.length === 0
          ? <p className="empty-state">Keine {opts.find(o => o.v === filter)?.l.toLowerCase()} Anfragen.</p>
          : requests.map(r => (
            <div key={r.id} className="booking-request-card">
              <div className="booking-request-header">
                <strong>{r.name}</strong>
                <span className="status-badge">{opts.find(o => o.v === r.status)?.l || r.status}</span>
              </div>
              <p>📞 {r.phone}{r.email && ` · ✉ ${r.email}`}</p>
              <p>📅 {r.preferred_date} um {r.preferred_time} Uhr</p>
              <p className="booking-service">📝 {r.service_description}</p>
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Eingegangen: {new Date(r.created_at).toLocaleString('de-DE')}</p>
              {r.status === 'open' && (
                <div className="booking-request-actions">
                  <button className="btn-success" onClick={() => update(r.id, { status: 'accepted' })}>Annehmen</button>
                  <button className="btn-danger" onClick={() => update(r.id, { status: 'rejected' })}>Ablehnen</button>
                </div>
              )}
              {r.status === 'accepted' && (
                <button className="btn-primary" onClick={() => update(r.id, { status: 'assigned' })}>Als zugewiesen markieren</button>
              )}
            </div>
          ))
      )}
    </div>
  );
}

// ── Timelogs Tab ───────────────────────────────────────────────────────────────

function TimelogsTab({ timelogs, assignments }: { timelogs: Timelog[]; assignments: Assignment[] }) {
  const assignmentMap = Object.fromEntries(assignments.map(a => [a.id, a]));
  const sorted = [...timelogs].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  return (
    <div className="timelogs-list">
      {sorted.length === 0 && <p className="empty-state">Keine Zeiteinträge vorhanden.</p>}
      {sorted.map(t => (
        <div key={t.id} className={`timelog-entry ${!t.end_time ? 'timelog-active' : ''}`}>
          <div className="timelog-header">
            <span className="timelog-assignment">{assignmentMap[t.assignment_id]?.title || t.assignment_id}</span>
            {!t.end_time && <span className="timelog-running-badge">Aktiv</span>}
            {t.is_signed && <span className="timelog-signed-badge">Signiert</span>}
          </div>
          <div className="timelog-times">
            <span>Start: {new Date(t.start_time).toLocaleString('de-DE')}</span>
            {t.end_time && <span>Ende: {new Date(t.end_time).toLocaleString('de-DE')}</span>}
          </div>
          <div className="timelog-duration">Dauer: {formatDuration(t.start_time, t.end_time)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────

interface Employee { id: string; username: string; full_name: string; email: string; role: string; created_at: string; }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', gebietsleiter: 'Gebietsleiter', kundenbetreuer: 'Kundenbetreuer',
  buchhaltung: 'Buchhaltung', mitarbeiter: 'Mitarbeiter', employee: 'Mitarbeiter',
};
const ROLE_COLORS: Record<string, string> = {
  admin: '#00454A', gebietsleiter: '#7C3AED', kundenbetreuer: '#0369A1',
  buchhaltung: '#B45309', mitarbeiter: '#374151', employee: '#374151',
};

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', role: 'mitarbeiter' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/users`, { headers: authHeaders() });
      if (r.ok) setEmployees(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`${API}/admin/users`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setMsg('Mitarbeiter angelegt!');
        setForm({ username: '', password: '', full_name: '', email: '', role: 'mitarbeiter' });
        setShowForm(false);
        load();
      } else {
        const d = await r.json();
        setMsg(d.message || 'Fehler beim Anlegen');
      }
    } finally { setSaving(false); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`${name} wirklich löschen?`)) return;
    await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  if (loading) return <div className="loading-text">Lade Mitarbeiter…</div>;

  return (
    <div className="employees-tab">
      <div className="employees-header">
        <h3>Mitarbeiterverwaltung ({employees.length})</h3>
        <button className="btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setMsg(''); }}>
          {showForm ? '× Abbrechen' : '+ Neuer Mitarbeiter'}
        </button>
      </div>

      {msg && <div className={`msg-banner ${msg.includes('Fehler') ? 'msg-error' : 'msg-success'}`}>{msg}</div>}

      {showForm && (
        <form className="employee-form" onSubmit={save}>
          <div className="form-row">
            <div className="form-group">
              <label>Voller Name *</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Max Mustermann" />
            </div>
            <div className="form-group">
              <label>Benutzername *</label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="max.mustermann" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Passwort *</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="Sicheres Passwort" />
            </div>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="max@helferchen.info" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rolle *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="kundenbetreuer">Kundenbetreuer</option>
                <option value="gebietsleiter">Gebietsleiter</option>
                <option value="buchhaltung">Buchhaltung</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Mitarbeiter anlegen'}</button>
        </form>
      )}

      <div className="employees-list">
        {employees.length === 0 && <p className="empty-state">Keine Mitarbeiter vorhanden.</p>}
        {employees.map(emp => (
          <div key={emp.id} className="employee-card">
            <div className="employee-avatar">{emp.full_name.charAt(0).toUpperCase()}</div>
            <div className="employee-info">
              <strong>{emp.full_name}</strong>
              <span className="employee-username">@{emp.username}</span>
              {emp.email && <span className="employee-email">{emp.email}</span>}
            </div>
            <span className="role-badge" style={{ background: ROLE_COLORS[emp.role] || '#374151' }}>
              {ROLE_LABELS[emp.role] || emp.role}
            </span>
            <button className="btn-danger btn-sm btn-icon" onClick={() => del(emp.id, emp.full_name)} title="Löschen">✕</button>
          </div>
        ))}
      </div>

      <div className="apk-download-box">
        <span>📲</span>
        <div>
          <strong>Helferchen App für Android</strong>
          <p>Zeiterfassung und Tourenplanung direkt auf dem Smartphone</p>
        </div>
        <a href="/downloads/helferchen-mobile.apk" className="btn-primary btn-sm" download>App herunterladen</a>
      </div>
    </div>
  );
}

// ── Map View (OpenStreetMap via Leaflet, colored pins) ─────────────────────────

interface MapAssignment extends Assignment {
  _pinColor?: 'green' | 'yellow';
}

function loadLeaflet(): Promise<void> {
  if ((window as any).L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Leaflet konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

function makePin(color: string) {
  const L = (window as any).L;
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

async function geocodeNominatim(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'de' } });
    const data = await r.json();
    if (!data[0]) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { return null; }
}

function OsmMapView({ mine, unassigned }: { mine: MapAssignment[]; unassigned: MapAssignment[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [status, setStatus] = useState('Karte wird geladen…');

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current) return;
      const L = (window as any).L;
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current).setView([51.1657, 10.4515], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapInstance.current);
      }
      markers.current.forEach(m => m.remove());
      markers.current = [];

      const all: Array<{ a: MapAssignment; color: string }> = [
        ...mine.map(a => ({ a, color: '#22c55e' })),
        ...unassigned.map(a => ({ a, color: '#eab308' })),
      ];
      setStatus(`Geocoding ${all.length} Adressen…`);
      let done = 0;
      all.forEach(async ({ a, color }, i) => {
        const address = a.customer?.address;
        if (!address) { done++; if (done === all.length) setStatus(''); return; }
        if (i > 0) await new Promise(r => setTimeout(r, i * 1100));
        const coords = await geocodeNominatim(address);
        done++;
        if (done === all.length) setStatus('');
        if (!coords || cancelled || !mapInstance.current) return;
        const marker = (window as any).L.marker(coords, { icon: makePin(color) })
          .addTo(mapInstance.current)
          .bindPopup(`<strong>${a.title}</strong><br>${address}<br><small>${color === '#22c55e' ? '🟢 Zugewiesen' : '🟡 Nicht zugewiesen'}</small>`);
        markers.current.push(marker);
      });
    }).catch(e => setStatus(e.message));
    return () => { cancelled = true; };
  }, [mine, unassigned]);

  return (
    <div>
      {status && <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0' }}>{status}</p>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '0.85rem' }}>
        <span>🟡 Nicht zugewiesen ({unassigned.length})</span>
        <span>🟢 Meine Aufträge ({mine.length})</span>
      </div>
      <div ref={mapRef} className="map-container" />
    </div>
  );
}

// ── Admin: Aufträge verwalten ───────────────────────────────────────────────────

function AssignmentsAdminTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ customer_id: '', assigned_user_id: '', title: '', description: '', scheduled_at: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, uRes, cRes] = await Promise.all([
        fetch(`${API}/assignments/all`, { headers: authHeaders() }),
        fetch(`${API}/admin/users`, { headers: authHeaders() }),
        fetch(`${API}/customers`, { headers: authHeaders() }).catch(() => ({ ok: false, json: async () => [] })),
      ]);
      if (aRes.ok) setAssignments(await aRes.json());
      if (uRes.ok) setEmployees(await uRes.json());
      if ((cRes as Response).ok) setCustomers(await (cRes as Response).json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reassign = async (id: string, userId: string) => {
    await fetch(`${API}/assignments/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ assigned_user_id: userId || null }),
    });
    setMsg('Zuweisung gespeichert.');
    setTimeout(() => setMsg(''), 3000);
    load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`${API}/assignments`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (r.ok) { setMsg('Auftrag erstellt!'); setShowCreate(false); load(); }
      else { const d = await r.json(); setMsg(d.message || 'Fehler'); }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loading-text">Lade Aufträge…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Auftragsübersicht ({assignments.length})</h3>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '× Abbrechen' : '+ Neuer Auftrag'}
        </button>
      </div>

      {msg && <div className="msg-banner msg-success" style={{ marginBottom: 12 }}>{msg}</div>}

      {showCreate && (
        <form className="employee-form" onSubmit={create} style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group">
              <label>Titel *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Einkaufshilfe" />
            </div>
            <div className="form-group">
              <label>Datum/Zeit *</label>
              <input type="datetime-local" required value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Kunde *</label>
              {customers.length > 0 ? (
                <select required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">– Kunde wählen –</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} – {c.address}</option>)}
                </select>
              ) : (
                <input required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} placeholder="Kunden-ID" />
              )}
            </div>
            <div className="form-group">
              <label>Mitarbeiter zuweisen</label>
              <select value={form.assigned_user_id} onChange={e => setForm(f => ({ ...f, assigned_user_id: e.target.value }))}>
                <option value="">– Nicht zugewiesen –</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Beschreibung</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optionale Details…" style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Auftrag erstellen'}</button>
        </form>
      )}

      <table className="admin-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Titel</th>
            <th>Kunde</th>
            <th>Termin</th>
            <th>Status</th>
            <th>Zugewiesen an</th>
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF' }}>Keine Aufträge vorhanden.</td></tr>}
          {assignments.map(a => (
            <tr key={a.id}>
              <td><strong>{a.title}</strong>{a.description && <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{a.description}</div>}</td>
              <td>{a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '–'}<div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{a.customer?.address}</div></td>
              <td style={{ whiteSpace: 'nowrap' }}>{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
              <td><span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span></td>
              <td>
                <select
                  value={a.assigned_user?.id || a.assigned_user_id || ''}
                  onChange={e => reassign(a.id, e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '2px 4px' }}
                >
                  <option value="">🟡 Nicht zugewiesen</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>🟢 {emp.full_name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Portal ────────────────────────────────────────────────────────────────

export default function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { navigate('/login'); return; }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      ]);
      if (aRes.status === 401 || tRes.status === 401) { localStorage.clear(); navigate('/login'); return; }
      setAssignments(await aRes.json());
      setTimelogs(await tRes.json());
    } catch { setError('Fehler beim Laden der Daten.'); }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  if (!user) return <div className="loading-screen">Laden…</div>;

  const isAdmin = user.role === 'admin';
  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'appointments', label: '📅 Termine' },
    { id: 'tour', label: '🗺️ Tour' },
    { id: 'assignments-admin', label: '📋 Aufträge', adminOnly: true },
    { id: 'booking-requests', label: '📬 Anfragen', adminOnly: true },
    { id: 'timelogs', label: '⏱ Zeiten' },
    { id: 'employees', label: '👥 Mitarbeiter', adminOnly: true },
  ];

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="portal-header-left">
          <img src="/logo.png" alt="Helferchen" style={{ height: '40px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
          <span className="portal-user">Angemeldet als <strong>{user.full_name}</strong></span>
          <a href="/downloads/helferchen-mobile.apk" className="btn-secondary btn-sm" style={{ marginLeft: '16px', fontSize: '0.8rem' }}>
            📲 App laden
          </a>
        </div>
        <button className="btn-logout" onClick={() => { localStorage.clear(); navigate('/'); }}>Abmelden</button>
      </header>

      <nav className="portal-tabs">
        {tabs.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'tab-active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="portal-content">
        {error && <div className="error-banner">{error}</div>}
        {loading && activeTab !== 'dashboard' ? <div className="loading-text">Daten werden geladen…</div> : (
          <>
            {activeTab === 'dashboard' && <DashboardTab user={user} />}
            {activeTab === 'appointments' && <AppointmentsTab assignments={assignments} onRefresh={loadData} />}
            {activeTab === 'tour' && (
              <div>
                <TourTab assignments={assignments} />
                <h3 style={{ margin: '24px 0 12px' }}>Kartenansicht (OpenStreetMap)</h3>
                <OsmMapView mine={assignments} unassigned={[]} />
              </div>
            )}
            {activeTab === 'booking-requests' && isAdmin && <BookingRequestsTab />}
            {activeTab === 'timelogs' && <TimelogsTab timelogs={timelogs} assignments={assignments} />}
            {activeTab === 'employees' && isAdmin && <EmployeesTab />}
            {activeTab === 'assignments-admin' && isAdmin && <AssignmentsAdminTab />}
          </>
        )}
      </main>
    </div>
  );
}
