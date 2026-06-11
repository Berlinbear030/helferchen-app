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
  address: string; service_description: string; preferred_date: string; preferred_time: string;
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
              {a.description && <p className="appointment-desc" style={{ fontSize: '0.85rem', color: '#6B7280', margin: '4px 0' }}>📝 {a.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appointments Tab ───────────────────────────────────────────────────────────

function AppointmentsTab({ assignments, onRefresh }: { assignments: Assignment[]; onRefresh: () => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const handleStatus = async (id: string, status: string) => {
    await fetch(`${API}/assignments/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
    onRefresh();
  };
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };
  return (
    <div className="appointments-list">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-action-outline" style={{ color: '#00454A', borderColor: '#00454A' }} onClick={handleManualRefresh} disabled={refreshing}>
          {refreshing ? '⌛ Lädt...' : '🔄 Aktualisieren'}
        </button>
      </div>
      {assignments.length === 0 && <p className="empty-state">Keine Termine zugewiesen.</p>}
      {assignments.map(a => (
        <div key={a.id} className={`appointment-card status-${a.status}`} style={{ borderLeft: '4px solid #00454A', padding: '16px', marginBottom: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div className="appointment-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong style={{ fontSize: '1.1rem' }}>{a.title}</strong>
            <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
          </div>
          <div className="appointment-details" style={{ marginBottom: '12px' }}>
            <p style={{ margin: '4px 0', fontSize: '0.95rem' }}>📍 <strong>{a.customer?.address || 'Keine Adresse'}</strong></p>
            <p style={{ margin: '4px 0', color: '#4B5563' }}>👤 {a.customer?.first_name} {a.customer?.last_name}</p>
            <p style={{ margin: '4px 0', color: '#4B5563' }}>📅 {new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} Uhr</p>
          </div>
          {a.description && (
            <p className="appointment-desc" style={{ padding: '8px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.85rem', color: '#374151', marginBottom: '12px' }}>
              📝 {a.description}
            </p>
          )}
          <div className="appointment-actions" style={{ display: 'flex', gap: '8px' }}>
            {a.status === 'pending' && <button className="btn-primary" onClick={() => handleStatus(a.id, 'in_progress')}>▶ Starten</button>}
            {a.status === 'in_progress' && <button className="btn-success" onClick={() => handleStatus(a.id, 'completed')}>✓ Abschließen</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tour Planning Tab ──────────────────────────────────────────────────────────

function TourTab({ assignments, unassigned, selectedDate, setSelectedDate, user }: { 
  assignments: Assignment[]; 
  unassigned: Assignment[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  user: User;
}) {
  const dayAssignments = assignments
    .filter(a => a.scheduled_at && a.scheduled_at.includes(selectedDate))
    .filter(a => user.role === 'admin' || a.assigned_user_id === user.id)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const dayUnassigned = unassigned
    .filter(a => a.scheduled_at && a.scheduled_at.includes(selectedDate))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="tour-tab">
      <div className="tour-header">
        <div className="tour-header-main">
          <h3>Tagesroute planen</h3>
          <p className="tour-date-display">{new Date(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="date-picker" />
      </div>

      <section className="tour-section">
        <h4 className="tour-section-title">
          {user.role === 'admin' ? `🟢 Alle Termine (${dayAssignments.length})` : `🟢 Meine Termine (${dayAssignments.length})`}
        </h4>
        {dayAssignments.length === 0 ? (
          <p className="empty-state">Keine eigenen Termine für diesen Tag.</p>
        ) : (
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
        )}
      </section>

      {dayUnassigned.length > 0 && (
        <section className="tour-section" style={{ marginTop: '24px' }}>
          <h4 className="tour-section-title">🟡 Offene Aufträge ({dayUnassigned.length})</h4>
          <div className="tour-route">
            {dayUnassigned.map((a, i) => (
              <div key={a.id} className="tour-stop unassigned">
                <div className="tour-stop-num" style={{ background: '#eab308' }}>?</div>
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
                  <span className="status-badge status-pending">Nicht zugewiesen</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Booking Requests Tab ───────────────────────────────────────────────────────

function BookingRequestsTab() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [assignSelects, setAssignSelects] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, uRes] = await Promise.all([
        fetch(`${API}/booking-requests?status=${filter}`, { headers: authHeaders() }),
        fetch(`${API}/admin/users`, { headers: authHeaders() }),
      ]);
      if (rRes.ok) setRequests(await rRes.json());
      if (uRes.ok) setEmployees(await uRes.json());
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
        <>
          {requests.length === 0
            ? <p className="empty-state">Keine {opts.find(o => o.v === filter)?.l.toLowerCase()} Anfragen.</p>
            : requests.map(r => (
              <div key={r.id} className="booking-request-card">
                <div className="booking-request-header">
                  <strong>{r.name}</strong>
                  <span className="status-badge">{opts.find(o => o.v === r.status)?.l || r.status}</span>
                </div>
                <p>📞 {r.phone}{r.email && ` · ✉ ${r.email}`}</p>
                {r.address && <p>📍 {r.address}</p>}
                <p>📅 {r.preferred_date} um {r.preferred_time} Uhr</p>
                <p className="booking-service">📝 {r.service_description}</p>
                <p style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Eingegangen: {new Date(r.created_at).toLocaleString('de-DE')}</p>
                {r.status === 'open' && (
                  <div className="booking-request-actions">
                    <button className="btn-success" onClick={() => update(r.id, { status: 'accepted' })}>Annehmen</button>
                    <button className="btn-danger" onClick={() => update(r.id, { status: 'rejected' })}>Ablehnen</button>
                  </div>
                )}
                {r.status !== 'rejected' && (
                  <div className="booking-request-actions" style={{ alignItems: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                        {r.assigned_user_id 
                          ? <span>✅ Zugewiesen an: <strong>{employees.find(e => e.id === r.assigned_user_id)?.full_name || 'Mitarbeiter'}</strong></span>
                          : 'Mitarbeiter zuweisen:'}
                      </label>
                      <select
                        value={assignSelects[r.id] || r.assigned_user_id || ''}
                        onChange={e => setAssignSelects(s => ({ ...s, [r.id]: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.9rem', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#fff' }}
                      >
                        <option value="">– Mitarbeiter wählen –</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                      </select>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ padding: '8px 16px', height: '38px' }}
                      disabled={!assignSelects[r.id] && !r.assigned_user_id}
                      onClick={() => update(r.id, { status: 'assigned', assigned_user_id: assignSelects[r.id] || r.assigned_user_id })}
                    >
                      {r.status === 'assigned' ? 'Zuweisung ändern' : 'Zuweisen'}
                    </button>
                  </div>
                )}
              </div>
            ))
          }
          {requests.some(r => r.address) && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ marginBottom: '4px' }}>Kartenansicht</h4>
              <BookingRequestsMap requests={requests} />
            </div>
          )}
        </>
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

const geoCache: Record<string, [number, number]> = {};

async function geocodeNominatim(address: string): Promise<[number, number] | null> {
  if (geoCache[address]) return geoCache[address];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'de' } });
    const data = await r.json();
    if (!data[0]) return null;
    const res: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geoCache[address] = res;
    return res;
  } catch { return null; }
}

function OsmMapView({ mine, unassigned, filterDate }: { mine: MapAssignment[]; unassigned: MapAssignment[]; filterDate?: string }) {
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
        mapInstance.current = L.map(mapRef.current).setView([51.1657, 10.4515], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapInstance.current);
      }
      markers.current.forEach(m => m.remove());
      markers.current = [];

      let mineFiltered = mine;
      let unassignedFiltered = unassigned;

      if (filterDate) {
        mineFiltered = mine.filter(a => a.scheduled_at?.includes(filterDate));
        unassignedFiltered = unassigned.filter(a => a.scheduled_at?.includes(filterDate));
      }

      const all: Array<{ a: MapAssignment; color: string }> = [];
      
      mineFiltered.forEach(a => {
        all.push({ a, color: a.assigned_user_id ? '#22c55e' : '#eab308' });
      });

      unassignedFiltered.forEach(a => {
        if (!all.some(item => item.a.id === a.id)) {
          all.push({ a, color: '#eab308' });
        }
      });
      
      if (all.length === 0) {
        setStatus('Keine Aufträge zum Anzeigen auf der Karte für diesen Tag.');
        return;
      }

      setStatus(`Lade ${all.length} Standorte…`);
      
      // Separate into cached and non-cached to speed up
      const cached = all.filter(item => item.a.customer?.address && geoCache[item.a.customer.address]);
      const needsGeocode = all.filter(item => item.a.customer?.address && !geoCache[item.a.customer.address]);

      // Add cached immediately
      cached.forEach(({ a, color }) => {
        const coords = geoCache[a.customer.address];
        const marker = L.marker(coords, { icon: makePin(color) })
          .addTo(mapInstance.current)
          .bindPopup(`<strong>${a.title}</strong><br>${a.customer.address}<br><small>${color === '#22c55e' ? '🟢 Zugewiesen' : '🟡 Nicht zugewiesen'}</small>`);
        markers.current.push(marker);
      });

      if (needsGeocode.length === 0) {
        setStatus('');
        if (cached.length > 0 && cached.length < 5) mapInstance.current.setView(geoCache[cached[0].a.customer.address], 12);
        return;
      }

      // Process non-cached with delay
      let done = 0;
      needsGeocode.forEach(async ({ a, color }, i) => {
        const address = a.customer.address;
        await new Promise(r => setTimeout(r, i * 1100)); // Respect Nominatim 1s limit
        
        const coords = await geocodeNominatim(address);
        done++;
        if (done >= needsGeocode.length) setStatus('');
        
        if (!coords || cancelled || !mapInstance.current) return;
        
        const marker = L.marker(coords, { icon: makePin(color) })
          .addTo(mapInstance.current)
          .bindPopup(`<strong>${a.title}</strong><br>${address}<br><small>${color === '#22c55e' ? '🟢 Zugewiesen' : '🟡 Nicht zugewiesen'}</small>`);
        markers.current.push(marker);
        
        if (cached.length === 0 && i === 0) {
          mapInstance.current.setView(coords, 12);
        }
      });
    }).catch(e => setStatus(e.message));
    return () => { cancelled = true; };
  }, [mine, unassigned, filterDate]);

  return (
    <div>
      {status && <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0' }}>{status}</p>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '0.85rem' }}>
        <span>🟡 Offen ({unassigned.length})</span>
        <span>🟢 Zugewiesen ({mine.length})</span>
        {filterDate && <span style={{ fontWeight: 'bold', color: '#00454A' }}>📅 Filter: {filterDate}</span>}
      </div>
      <div ref={mapRef} className="map-container" />
    </div>
  );
}

// ── Booking Requests Map ───────────────────────────────────────────────────────

function BookingRequestsMap({ requests }: { requests: BookingRequest[] }) {
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

      const withAddress = requests.filter(r => r.address);
      if (withAddress.length === 0) { setStatus('Keine Adressen zum Anzeigen.'); return; }
      setStatus(`Geocoding ${withAddress.length} Adressen…`);
      let done = 0;
      withAddress.forEach(async (r, i) => {
        if (i > 0) await new Promise(res => setTimeout(res, i * 1100));
        const coords = await geocodeNominatim(r.address);
        done++;
        if (done === withAddress.length) setStatus('');
        if (!coords || cancelled || !mapInstance.current) return;
        const statusColor = r.status === 'open' ? '#f59e0b' : r.status === 'accepted' ? '#3b82f6' : '#6b7280';
        const marker = (window as any).L.marker(coords, { icon: makePin(statusColor) })
          .addTo(mapInstance.current)
          .bindPopup(
            `<strong>${r.name}</strong><br>` +
            `📍 ${r.address}<br>` +
            `📅 ${r.preferred_date} ${r.preferred_time} Uhr<br>` +
            `📝 ${r.service_description.slice(0, 60)}${r.service_description.length > 60 ? '…' : ''}<br>` +
            `<small style="color:${statusColor}">${r.status === 'open' ? '🟡 Offen' : r.status === 'accepted' ? '🔵 Angenommen' : r.status}</small>`
          );
        markers.current.push(marker);
      });
    }).catch(e => setStatus(e.message));
    return () => { cancelled = true; };
  }, [requests]);

  return (
    <div style={{ marginTop: '16px' }}>
      {status && <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0' }}>{status}</p>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '0.85rem' }}>
        <span>🟡 Offen</span>
        <span>🔵 Angenommen</span>
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
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [form, setForm] = useState<any>({ customer_id: '', assigned_user_id: '', title: '', description: '', scheduled_at: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, uRes, cRes, rRes] = await Promise.all([
        fetch(`${API}/assignments/all`, { headers: authHeaders() }),
        fetch(`${API}/admin/users`, { headers: authHeaders() }),
        fetch(`${API}/customers`, { headers: authHeaders() }).catch(() => ({ ok: false, json: async () => [] })),
        fetch(`${API}/booking-requests?status=accepted`, { headers: authHeaders() }),
      ]);
      if (aRes.ok) setAssignments(await aRes.json());
      if (uRes.ok) setEmployees(await uRes.json());
      if ((cRes as Response).ok) setCustomers(await (cRes as Response).json());
      if (rRes.ok) setRequests(await rRes.json());
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

  const convertRequest = (r: BookingRequest) => {
    const existing = customers.find(c => c.phone_number === r.phone || (c.first_name + ' ' + c.last_name) === r.name);
    setForm({
      customer_id: existing ? existing.id : 'NEW_CUSTOMER',
      assigned_user_id: '',
      title: `Service: ${r.service_description.slice(0, 20)}`,
      description: r.service_description,
      scheduled_at: `${r.preferred_date}T${r.preferred_time}`,
      new_customer: { name: r.name, phone: r.phone, email: r.email, address: r.address }
    });
    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    // Normalize both NEW_CUSTOMER variants to the same value expected by backend
    if (payload.customer_id === 'NEW_CUSTOMER_DIRECT') {
      payload.customer_id = 'NEW_CUSTOMER';
    }
    try {
      const r = await fetch(`${API}/assignments`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        setMsg('✅ Auftrag erstellt!');
        setShowCreate(false);
        setForm({ customer_id: '', assigned_user_id: '', title: '', description: '', scheduled_at: '' });
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setMsg('❌ Fehler: ' + (d.message || 'Auftrag konnte nicht gespeichert werden.'));
      }
    } catch {
      setMsg('❌ Netzwerkfehler. Bitte Verbindung prüfen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-text">Lade Aufträge…</div>;

  return (
    <div className="assignments-admin-layout" style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Auftragsübersicht ({assignments.length})</h3>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '× Abbrechen' : '+ Neuer Auftrag'}
          </button>
        </div>

        {msg && <div className={`msg-banner ${msg.startsWith('❌') ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: 12 }}>{msg}</div>}

        {showCreate && (
          <form className="employee-form" onSubmit={create} style={{ marginBottom: 24, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
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
                <select required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">– Kunde wählen –</option>
                  <option value="NEW_CUSTOMER_DIRECT">🆕 Neuer Kunde (direkt anlegen)</option>
                  {form.customer_id === 'NEW_CUSTOMER' && <option value="NEW_CUSTOMER">🆕 Neu: {form.new_customer?.name}</option>}
                  {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} – {c.address}</option>)}
                </select>
                {(form.customer_id === 'NEW_CUSTOMER' || form.customer_id === 'NEW_CUSTOMER_DIRECT') && (
                  <div style={{ marginTop: '8px', padding: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#059669', marginBottom: '6px', fontWeight: '600' }}>
                      Neuen Kunden anlegen:
                    </div>
                    {form.customer_id === 'NEW_CUSTOMER_DIRECT' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input placeholder="Name (Vor- und Nachname) *" required value={form.new_customer?.name || ''} onChange={e => setForm((f: any) => ({ ...f, new_customer: { ...f.new_customer, name: e.target.value } }))} style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <input placeholder="Telefon *" required value={form.new_customer?.phone || ''} onChange={e => setForm((f: any) => ({ ...f, new_customer: { ...f.new_customer, phone: e.target.value } }))} style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.85rem' }} />
                        <input placeholder="Adresse *" required value={form.new_customer?.address || ''} onChange={e => setForm((f: any) => ({ ...f, new_customer: { ...f.new_customer, address: e.target.value } }))} style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.85rem' }} />
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                        {form.new_customer?.name} · {form.new_customer?.phone}
                        <br />Adresse: {form.new_customer?.address}
                      </div>
                    )}
                  </div>
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

        <table className="admin-table" style={{ width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px' }}>Titel / Auftrag</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Kunde</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>📍 Adresse</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>📝 Arbeiten / Details</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>📅 Termin</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px' }}>Zuweisung</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Keine Aufträge vorhanden.</td></tr>}
            {assignments.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#00454A' }}>{a.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>ID: {a.id.slice(0, 8)}</div>
                </td>
                <td style={{ padding: '12px' }}>
                  {a.customer ? (
                    <div>
                      <div style={{ fontWeight: '600' }}>{a.customer.first_name} {a.customer.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>📞 {a.customer.phone_number}</div>
                    </div>
                  ) : '–'}
                </td>
                <td style={{ padding: '12px' }}>
                  {a.customer ? (
                    <div style={{ maxWidth: '300px', fontSize: '0.9rem', fontWeight: '500', color: '#111827' }}>
                      📍 {a.customer.address}
                    </div>
                  ) : (
                    <div style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      ⚠️ Adresse fehlt (Kein Kunde!)
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#1F2937', fontWeight: '600', marginBottom: '4px' }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', maxWidth: '350px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', background: '#F3F4F6', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', lineHeight: '1.4' }}>
                    {a.description || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Keine weiteren Details angegeben</span>}
                  </div>
                </td>
                <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                  {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–'}
                </td>
                <td style={{ padding: '12px' }}>
                  <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                </td>
                <td style={{ padding: '12px' }}>
                  <select
                    value={a.assigned_user?.id || a.assigned_user_id || ''}
                    onChange={e => reassign(a.id, e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #D1D5DB', width: '100%' }}
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

      <div className="assignments-sidebar" style={{ width: '300px', flexShrink: 0, background: '#F3F4F6', padding: '16px', borderRadius: '8px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Angenommene Anfragen</h4>
        {requests.length === 0 ? <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Keine Anfragen zum Umwandeln.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.map(r => (
              <div key={r.id} style={{ background: '#fff', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{r.name}</div>
                <div style={{ color: '#4B5563', fontSize: '0.8rem', marginBottom: '8px' }}>{r.service_description.slice(0, 50)}...</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6B7280' }}>{r.preferred_date}</span>
                  <button className="btn-primary btn-sm" style={{ padding: '2px 8px' }} onClick={() => convertRequest(r)}>Umwandeln</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Portal ────────────────────────────────────────────────────────────────

export default function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassignedAssignments, setUnassignedAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const navigate = useNavigate();
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { navigate('/login'); return; }
    setUser(JSON.parse(userData));
  }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); deferredPrompt.current = e; };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const isAdmin = user?.role === 'admin';
      const assignmentsUrl = isAdmin ? `${API}/assignments/all` : `${API}/assignments/my`;
      
      const [aRes, tRes, mRes] = await Promise.all([
        fetch(assignmentsUrl, { headers: authHeaders() }),
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
        fetch(`${API}/assignments/map`, { headers: authHeaders() }),
      ]);
      if (aRes.status === 401 || tRes.status === 401) { localStorage.clear(); navigate('/login'); return; }
      
      const mine = await aRes.json();
      const logs = await tRes.json();
      const mapData = await mRes.json();

      setAssignments(mine);
      setTimelogs(logs);
      setUnassignedAssignments(mapData.unassigned || []);
    } catch { setError('Fehler beim Laden der Daten.'); }
    finally { setLoading(false); }
  }, [navigate, user?.role]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleInstallApp = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
    } else {
      alert('App ist bereits installiert oder öffne diese Seite im Browser und nutze "Zum Startbildschirm hinzufügen".');
    }
  };

  const handleOrderMarketing = () => {
    window.location.href = '/werbeartikel';
  };

  if (!user) return <div className="loading-screen">Laden…</div>;

  const isAdmin = user.role === 'admin';
  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'appointments', label: '📅 Termine' },
    { id: 'tour', label: '🗺️ Tour' },
    { id: 'booking-requests', label: '📬 Anfragen', adminOnly: true },
    { id: 'timelogs', label: '⏱ Zeiten' },
    { id: 'employees', label: '👥 Mitarbeiter', adminOnly: true },
    { id: 'assignments-admin', label: '🧾 Rechnungen', adminOnly: true },
  ];

  return (
    <div className="portal-layout">
      <div className="portal-header-wrap">
        <header className="portal-header">
          <div className="portal-header-left">
            <img src="/logo.png" alt="Helferchen" style={{ height: '40px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            <span className="portal-user">Angemeldet als <strong>{user?.full_name}</strong></span>
          </div>
          <button className="btn-logout" onClick={() => { localStorage.clear(); navigate('/'); }} style={{ backgroundColor: '#dc2626', color: 'white', fontWeight: 'bold' }}>
            Abmelden
          </button>
        </header>

        <div className="portal-action-bar">
          <div className="portal-action-left">
            <button className="btn-action-outline" onClick={handleInstallApp}>
              <span>📱</span> App laden
            </button>
            <button className="btn-action-outline" onClick={handleOrderMarketing}>
              <span>🖨</span> Werbematerial bestellen
            </button>
          </div>
          {isAdmin && (
            <button className="btn-action-billing" onClick={() => navigate('/admin/billing')}>
              Abrechnung
            </button>
          )}
        </div>
      </div>

      <nav className="portal-tabs">
        {tabs.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'tab-active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
        {isAdmin && (
          <button className="tab-btn tab-btn--settings" onClick={() => navigate('/admin')} title="Admin-Einstellungen">
            ⚙
          </button>
        )}
      </nav>

      <main className="portal-content">
        {error && <div className="error-banner">{error}</div>}
        {loading && activeTab !== 'dashboard' ? <div className="loading-text">Daten werden geladen…</div> : (
          <>
            {activeTab === 'dashboard' && <DashboardTab user={user} />}
            {activeTab === 'appointments' && <AppointmentsTab assignments={assignments} onRefresh={loadData} />}
            {activeTab === 'tour' && (
              <div>
                <TourTab assignments={assignments} unassigned={unassignedAssignments} selectedDate={selectedDate} setSelectedDate={setSelectedDate} user={user} />
                <h3 style={{ margin: '24px 0 12px' }}>Kartenansicht (OpenStreetMap)</h3>
                <OsmMapView mine={assignments} unassigned={unassignedAssignments} filterDate={selectedDate} />
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
