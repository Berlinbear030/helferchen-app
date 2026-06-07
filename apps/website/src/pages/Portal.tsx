import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const API = '/api';

interface User { id: string; full_name: string; role: string; }
interface Customer { id: string; first_name: string; last_name: string; address: string; }
interface Assignment { id: string; title: string; description: string; scheduled_at: string; status: string; customer: Customer; }
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

type Tab = 'dashboard' | 'appointments' | 'tour' | 'booking-requests' | 'timelogs';

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

// ── Map View ───────────────────────────────────────────────────────────────────

function MapView({ assignments }: { assignments: Assignment[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapsReady, setMapsReady] = useState(!!(window as any).google?.maps);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if ((window as any).google?.maps) { setMapsReady(true); return; }
    const KEY = (window as any).__GOOGLE_MAPS_KEY__ || '';
    if (!KEY) { setMapError('Kein Google Maps API-Schlüssel konfiguriert.'); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places`;
    s.async = true;
    s.onload = () => setMapsReady(true);
    s.onerror = () => setMapError('Google Maps konnte nicht geladen werden.');
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, { center: { lat: 52.52, lng: 13.405 }, zoom: 11 });
    const geocoder = new google.maps.Geocoder();
    assignments.forEach(a => {
      if (!a.customer?.address) return;
      geocoder.geocode({ address: a.customer.address }, (results: any, status: string) => {
        if (status !== 'OK' || !results[0]) return;
        const marker = new google.maps.Marker({ position: results[0].geometry.location, map, title: a.title });
        const info = new google.maps.InfoWindow({ content: `<strong>${a.title}</strong><br>${a.customer.address}` });
        marker.addListener('click', () => info.open(map, marker));
      });
    });
  }, [mapsReady, assignments]);

  if (mapError) return <div className="map-placeholder"><p>{mapError}</p></div>;
  return <div ref={mapRef} className="map-container" />;
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
    { id: 'booking-requests', label: '📬 Anfragen', adminOnly: true },
    { id: 'timelogs', label: '⏱ Zeiten' },
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
                <h3 style={{ margin: '24px 0 12px' }}>Kartenansicht</h3>
                <MapView assignments={assignments} />
              </div>
            )}
            {activeTab === 'booking-requests' && isAdmin && <BookingRequestsTab />}
            {activeTab === 'timelogs' && <TimelogsTab timelogs={timelogs} assignments={assignments} />}
          </>
        )}
      </main>
    </div>
  );
}
