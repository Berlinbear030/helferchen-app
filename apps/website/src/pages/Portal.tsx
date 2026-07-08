import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const API = '/api';

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '28px 32px', maxWidth: '380px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', color: '#111', marginBottom: '24px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '9px 22px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: '0.95rem' }}>Abbrechen</button>
          <button onClick={onConfirm} style={{ padding: '9px 22px', borderRadius: '6px', border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>Löschen</button>
        </div>
      </div>
    </div>
  );
}

interface User { id: string; full_name: string; role: string; permissions?: string[]; }
interface Customer { id: string; first_name: string; last_name: string; address: string; phone_number?: string; email?: string; }
interface Assignment { id: string; title: string; description: string; scheduled_at: string; status: string; customer: Customer; assigned_user_id?: string; assigned_user?: { id: string; full_name: string } | null; }
interface Timelog { id: string; assignment_id: string; start_time: string; end_time: string | null; is_signed: boolean; }
interface Report { id: string; assignment_id: string; timelog_id: string; notes: string; signature_id: string | null; created_at: string; }
interface AssignmentWithRevenue extends Assignment {
  assigned_user?: { id: string; full_name: string } | null;
  revenue?: number;
}
interface DashboardStats {
  today_appointments: number; open_assignments: number; completed_today: number;
  daily_revenue: number; monthly_revenue: number; open_booking_requests: number;
  recent_assignments: Assignment[];
  daily_completed: AssignmentWithRevenue[];
  monthly_completed: AssignmentWithRevenue[];
  open_assignments_list: AssignmentWithRevenue[];
}
interface BookingRequest {
  id: string; name: string; phone: string; email: string;
  address: string; service_description: string; preferred_date: string; preferred_time: string;
  status: string; assigned_user_id: string | null; notes: string; created_at: string;
}
interface CallLog {
  id: string; caller_id: string; unique_id: string | null;
  status: 'missed' | 'answered' | 'callback_initiated' | 'handled';
  note: string | null; handled_by: string | null; created_at: string;
}

type Tab = 'dashboard' | 'appointments' | 'tour' | 'booking-requests' | 'timelogs' | 'employees' | 'assignments-admin' | 'kunden' | 'anruf';

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

type DetailType = 'daily' | 'monthly' | 'open' | 'booking';

function DashboardTab({ user }: { user: User }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [detailBookings, setDetailBookings] = useState<BookingRequest[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/dashboard/stats`, { headers: authHeaders() })
      .then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  const handleCardClick = async (type: DetailType) => {
    if (detailType === type) { setDetailType(null); return; }
    setDetailType(type);
    if (type === 'booking' && !detailBookings.length) {
      setBookingLoading(true);
      const r = await fetch(`${API}/booking-requests?status=open`, { headers: authHeaders() });
      if (r.ok) setDetailBookings(await r.json());
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="loading-text">Lade Dashboard…</div>;
  if (!stats) return <div className="error-banner">Dashboard konnte nicht geladen werden.</div>;

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const detailTitles: Record<DetailType, string> = {
    daily: 'Heutige Einnahmen – Details',
    monthly: 'Monatliche Einnahmen – Details',
    open: 'Offene Aufträge',
    booking: 'Neue Buchungsanfragen',
  };

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
        <div
          className={`stat-card stat-success stat-card--clickable${detailType === 'daily' ? ' stat-card--active' : ''}`}
          onClick={() => handleCardClick('daily')}
          role="button" tabIndex={0}
        >
          <span className="stat-value">{stats.daily_revenue.toFixed(2)} €</span>
          <span className="stat-label">Tageseinnahmen ▼</span>
        </div>
        <div
          className={`stat-card stat-accent stat-card--clickable${detailType === 'monthly' ? ' stat-card--active' : ''}`}
          onClick={() => handleCardClick('monthly')}
          role="button" tabIndex={0}
        >
          <span className="stat-value">{stats.monthly_revenue.toFixed(2)} €</span>
          <span className="stat-label">Monatseinnahmen ▼</span>
        </div>
        <div
          className={`stat-card stat-warning stat-card--clickable${detailType === 'open' ? ' stat-card--active' : ''}`}
          onClick={() => handleCardClick('open')}
          role="button" tabIndex={0}
        >
          <span className="stat-value">{stats.open_assignments}</span>
          <span className="stat-label">Offene Aufträge ▼</span>
        </div>
        {user.role === 'admin' && (
          <div
            className={`stat-card stat-info stat-card--clickable${detailType === 'booking' ? ' stat-card--active' : ''}`}
            onClick={() => handleCardClick('booking')}
            role="button" tabIndex={0}
          >
            <span className="stat-value">{stats.open_booking_requests}</span>
            <span className="stat-label">Neue Buchungsanfragen ▼</span>
          </div>
        )}
      </div>

      {detailType && (
        <div className="detail-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3>{detailTitles[detailType]}</h3>
            <button onClick={() => setDetailType(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
          </div>
          {detailType === 'booking' ? (
            bookingLoading ? <div className="loading-text">Lade Details…</div> :
            detailBookings.length === 0 ? (
              <p className="empty-state">Keine offenen Buchungsanfragen.</p>
            ) : (
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Name</th><th>Telefon</th><th>Dienstleistung</th><th>Wunschdatum</th><th>Eingegangen</th>
                  </tr>
                </thead>
                <tbody>
                  {detailBookings.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.name}</td>
                      <td>{b.phone}</td>
                      <td>{b.service_description.length > 50 ? b.service_description.slice(0, 50) + '…' : b.service_description}</td>
                      <td>{b.preferred_date} {b.preferred_time && `${b.preferred_time} Uhr`}</td>
                      <td>{new Date(b.created_at).toLocaleDateString('de-DE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (detailType === 'daily' || detailType === 'monthly') ? (() => {
            const rows = detailType === 'daily' ? stats.daily_completed : stats.monthly_completed;
            const total = rows.reduce((s, a) => s + (a.revenue ?? 0), 0);
            return rows.length === 0 ? (
              <p className="empty-state">Keine abgeschlossenen Aufträge für diesen Zeitraum.</p>
            ) : (
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Auftrag</th><th>Kunde</th><th>Mitarbeiter</th><th>Termin</th><th style={{ textAlign: 'right' }}>Einnahmen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.title}</td>
                      <td>{a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '–'}</td>
                      <td>{a.assigned_user?.full_name || <span style={{ color: '#9CA3AF' }}>–</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{(a.revenue ?? 0).toFixed(2)} €</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid #E5E7EB', paddingTop: '8px' }}>Gesamt:</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A', borderTop: '2px solid #E5E7EB', paddingTop: '8px' }}>{total.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            );
          })() : (() => {
            const rows = stats.open_assignments_list;
            return rows.length === 0 ? (
              <p className="empty-state">Keine offenen Aufträge.</p>
            ) : (
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Auftrag</th><th>Kunde</th><th>Status</th><th>Mitarbeiter</th><th>Termin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.title}</td>
                      <td>{a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '–'}</td>
                      <td><span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span></td>
                      <td>{a.assigned_user?.full_name || <span style={{ color: '#9CA3AF' }}>Nicht zugewiesen</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

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

function AppointmentsTab({ assignments, onRefresh, canDelete }: { assignments: Assignment[]; onRefresh: () => void; canDelete?: boolean }) {
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);
  const [delMsg, setDelMsg] = useState('');

  const handleStatus = async (id: string, status: string) => {
    await fetch(`${API}/assignments/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
    onRefresh();
  };
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };
  const confirmDelExecute = async () => {
    if (!confirmDel) return;
    const r = await fetch(`${API}/assignments/${confirmDel.id}`, { method: 'DELETE', headers: authHeaders() });
    setConfirmDel(null);
    if (r.ok) {
      onRefresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setDelMsg('❌ ' + (d.message || 'Löschen fehlgeschlagen'));
      setTimeout(() => setDelMsg(''), 5000);
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(1);

  const filtered = assignments
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .filter(a => {
      if (timeFilter === 'all') return true;
      if (timeFilter === 'today') return a.scheduled_at.startsWith(todayStr);
      const d = new Date(a.scheduled_at);
      if (timeFilter === 'week') return d >= weekAgo;
      if (timeFilter === 'month') return d >= monthAgo;
      return true;
    });

  const filterRowSt: React.CSSProperties = { display: 'flex', gap: '6px', flexWrap: 'wrap' };
  const fbtn = (active: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem', background: active ? '#00454A' : 'white', color: active ? 'white' : '#374151', fontWeight: active ? 700 : 400 });

  return (
    <div className="appointments-list">
      {confirmDel && <ConfirmDialog message={`Auftrag "${confirmDel.title}" wirklich löschen? Alle Zeitnachweise und Berichte werden ebenfalls gelöscht.`} onConfirm={confirmDelExecute} onCancel={() => setConfirmDel(null)} />}
      {delMsg && <div className="msg-banner msg-error">{delMsg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={filterRowSt}>
            {[['all','Alle'],['pending','Ausstehend'],['in_progress','In Bearbeitung'],['completed','Abgeschlossen']].map(([v,l]) => (
              <button key={v} style={fbtn(statusFilter === v)} onClick={() => setStatusFilter(v)}>{l}</button>
            ))}
          </div>
          <div style={filterRowSt}>
            {[['all','Alle Zeiten'],['today','Heute'],['week','Diese Woche'],['month','Dieser Monat']].map(([v,l]) => (
              <button key={v} style={fbtn(timeFilter === v)} onClick={() => setTimeFilter(v)}>{l}</button>
            ))}
          </div>
        </div>
        <button className="btn-action-outline" style={{ color: '#00454A', borderColor: '#00454A' }} onClick={handleManualRefresh} disabled={refreshing}>
          {refreshing ? '⌛ Lädt...' : '🔄 Aktualisieren'}
        </button>
      </div>
      {filtered.length === 0 && <p className="empty-state">Keine Termine für diesen Filter.</p>}
      {filtered.map(a => (
        <div key={a.id} className={`appointment-card status-${a.status}`} style={{ borderLeft: '4px solid #00454A', padding: '16px', marginBottom: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div className="appointment-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong style={{ fontSize: '1.1rem' }}>{a.title}</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
              {canDelete && (
                <button className="btn-danger btn-sm btn-icon" onClick={() => setConfirmDel({ id: a.id, title: a.title })} title="Auftrag löschen">✕</button>
              )}
            </div>
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

function BookingRequestsTab({ canDelete }: { canDelete: boolean }) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [assignSelects, setAssignSelects] = useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState('');

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

  const deleteRequest = (id: string, name: string) => {
    setConfirmDel({ id, name });
  };

  const confirmDelExecute = async () => {
    if (!confirmDel) return;
    try {
      const r = await fetch(`${API}/booking-requests/${confirmDel.id}`, { method: 'DELETE', headers: authHeaders() });
      setConfirmDel(null);
      if (r.ok) {
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setMsg('❌ ' + (d.message || d.error || 'Löschen fehlgeschlagen'));
        setTimeout(() => setMsg(''), 5000);
      }
    } catch {
      setConfirmDel(null);
      setMsg('❌ Netzwerkfehler beim Löschen');
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const opts = [{ v: 'open', l: 'Offen' }, { v: 'accepted', l: 'Angenommen' }, { v: 'rejected', l: 'Abgelehnt' }, { v: 'assigned', l: 'Zugewiesen' }];

  return (
    <div className="booking-requests-tab">
      {confirmDel && <ConfirmDialog message={`Anfrage von "${confirmDel.name}" wirklich löschen?`} onConfirm={confirmDelExecute} onCancel={() => setConfirmDel(null)} />}
      {msg && <div className={`msg-banner ${msg.startsWith('❌') ? 'msg-error' : 'msg-success'}`}>{msg}</div>}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-badge">{opts.find(o => o.v === r.status)?.l || r.status}</span>
                    {canDelete && (
                      <button className="btn-danger btn-sm btn-icon" onClick={() => deleteRequest(r.id, r.name)} title="Anfrage löschen">✕</button>
                    )}
                  </div>
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

interface Employee { id: string; username: string; full_name: string; email: string; role: string; permissions?: string; created_at: string; }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', gebietsleiter: 'Gebietsleiter', kundenbetreuer: 'Kundenbetreuer',
  buchhaltung: 'Buchhaltung', mitarbeiter: 'Mitarbeiter', employee: 'Mitarbeiter',
};
const ROLE_COLORS: Record<string, string> = {
  admin: '#00454A', gebietsleiter: '#7C3AED', kundenbetreuer: '#0369A1',
  buchhaltung: '#B45309', mitarbeiter: '#374151', employee: '#374151',
};

interface LiveStatus { id: string; username: string; status: 'on_duty' | 'busy' | 'offline'; }

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  on_duty: { color: '#22c55e', label: 'In Dienst' },
  busy:    { color: '#f97316', label: 'Im Auftrag / Gespräch' },
  offline: { color: '#d1d5db', label: 'Nicht eingeloggt' },
};

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/admin/users/live-status`, { headers: authHeaders() });
      if (r.ok) {
        const data: LiveStatus[] = await r.json();
        const map: Record<string, LiveStatus> = {};
        for (const s of data) map[s.id] = s;
        setLiveStatus(map);
      }
    } catch (_) {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/users`, { headers: authHeaders() });
      if (r.ok) setEmployees(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    fetchLiveStatus();
    statusIntervalRef.current = setInterval(fetchLiveStatus, 15000);
    return () => { if (statusIntervalRef.current) clearInterval(statusIntervalRef.current); };
  }, [load, fetchLiveStatus]);

  const del = async (id: string, name: string) => {
    setConfirmDel({ id, name });
  };

  const confirmDelExecute = async () => {
    if (!confirmDel) return;
    await fetch(`${API}/admin/users/${confirmDel.id}`, { method: 'DELETE', headers: authHeaders() });
    setConfirmDel(null);
    load();
  };

  if (loading) return <div className="loading-text">Lade Mitarbeiter…</div>;

  return (
    <div className="employees-tab">
      {confirmDel && <ConfirmDialog message={`${confirmDel.name} wirklich löschen?`} onConfirm={confirmDelExecute} onCancel={() => setConfirmDel(null)} />}
      <div className="employees-header">
        <h3>Mitarbeiterverwaltung ({employees.length})</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#6b7280', alignItems: 'center' }}>
          {Object.values(STATUS_DOT).map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {msg && <div className={`msg-banner ${msg.includes('Fehler') ? 'msg-error' : 'msg-success'}`}>{msg}</div>}

      <div className="employees-list">
        {employees.length === 0 && <p className="empty-state">Keine Mitarbeiter vorhanden.</p>}
        {employees.map(emp => {
          const ls = liveStatus[emp.id];
          const dot = STATUS_DOT[ls?.status ?? 'offline'];
          return (
            <div key={emp.id} className="employee-card">
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className="employee-avatar">{emp.full_name.charAt(0).toUpperCase()}</div>
                <span
                  title={dot.label}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 12, height: 12, borderRadius: '50%',
                    background: dot.color, border: '2px solid #fff',
                  }}
                />
              </div>
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
          );
        })}
      </div>

    </div>
  );
}

// ── Map View (OpenStreetMap via Leaflet, colored pins) ─────────────────────────

interface MapAssignment extends Assignment {
  _pinColor?: 'green' | 'yellow';
  _type?: 'booking_request';
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
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"><path d="M14 0C6.3 0 0 6.3 0 14c0 5.3 2.9 9.9 7.2 12.3L14 38l6.8-11.7C25.1 23.9 28 19.3 28 14 28 6.3 21.7 0 14 0z" fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/><circle cx="14" cy="14" r="5.5" fill="white" opacity="0.7"/></svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -40],
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function makeAssignmentPopupHtml(a: MapAssignment, isAssigned: boolean, showAcceptBtn: boolean): string {
  const customer = a.customer;
  const scheduledStr = a.scheduled_at
    ? new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  const title = escHtml(a.title || '');
  const addr = customer ? escHtml(customer.address) : '';
  const name = customer ? `${escHtml(customer.first_name)} ${escHtml(customer.last_name)}` : '';
  const isBookingRequest = a._type === 'booking_request';
  const itemType = isBookingRequest ? 'booking_request' : 'assignment';

  if (isAssigned) {
    const assignee = escHtml(a.assigned_user?.full_name || 'Mitarbeiter');
    return `<div style="min-width:190px;font-family:system-ui,sans-serif;padding:2px">
      <strong style="font-size:0.95rem;display:block;margin-bottom:6px">${title}</strong>
      ${addr ? `<div style="font-size:0.83rem;color:#374151;margin-bottom:2px">📍 ${addr}</div>` : ''}
      ${name ? `<div style="font-size:0.83rem;color:#6B7280;margin-bottom:2px">👤 ${name}</div>` : ''}
      ${scheduledStr ? `<div style="font-size:0.83rem;color:#6B7280;margin-bottom:6px">📅 ${scheduledStr}</div>` : ''}
      <div style="font-size:0.82rem;color:#15803d;font-weight:600">🟢 Zugewiesen an: ${assignee}</div>
      <div style="font-size:0.82rem;color:#374151;margin-top:2px">Status: ${statusLabel(a.status)}</div>
    </div>`;
  } else {
    const acceptBtn = showAcceptBtn
      ? `<button onclick="window.__acceptMapItem('${a.id}','${itemType}')" style="margin-top:10px;padding:7px 0;background:#22c55e;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.88rem;font-weight:600;width:100%">✓ Auftrag annehmen</button>`
      : '';
    const label = isBookingRequest
      ? `<div style="font-size:0.82rem;color:#ca8a04;font-weight:600">🟡 Anfrage – noch kein Auftrag</div>`
      : `<div style="font-size:0.82rem;color:#ca8a04;font-weight:600">🟡 Offen – nicht zugewiesen</div>`;
    return `<div style="min-width:190px;font-family:system-ui,sans-serif;padding:2px">
      <strong style="font-size:0.95rem;display:block;margin-bottom:6px">${title}</strong>
      ${addr ? `<div style="font-size:0.83rem;color:#374151;margin-bottom:2px">📍 ${addr}</div>` : ''}
      ${name ? `<div style="font-size:0.83rem;color:#6B7280;margin-bottom:2px">👤 ${name}</div>` : ''}
      ${scheduledStr ? `<div style="font-size:0.83rem;color:#6B7280;margin-bottom:6px">📅 ${scheduledStr}</div>` : ''}
      ${label}
      ${acceptBtn}
    </div>`;
  }
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

function OsmMapView({ mine, unassigned, filterDate, user, onAccept }: {
  mine: MapAssignment[];
  unassigned: MapAssignment[];
  filterDate?: string;
  user?: User;
  onAccept?: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [status, setStatus] = useState('Karte wird geladen…');
  const [acceptMsg, setAcceptMsg] = useState('');

  useEffect(() => {
    (window as any).__acceptMapItem = async (id: string, type: string) => {
      if (!user) return;
      try {
        let r: Response;
        if (type === 'booking_request') {
          r = await fetch(`${API}/booking-requests/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status: 'assigned', assigned_user_id: user.id }),
          });
        } else {
          r = await fetch(`${API}/assignments/${id}/self-assign`, {
            method: 'POST',
            headers: authHeaders(),
          });
        }
        if (r.ok) {
          mapInstance.current?.closePopup();
          setAcceptMsg('✅ Auftrag angenommen!');
          setTimeout(() => setAcceptMsg(''), 3000);
          onAccept?.();
        } else if (r.status === 409) {
          setAcceptMsg('⚠️ Auftrag wurde bereits vergeben.');
          setTimeout(() => setAcceptMsg(''), 3000);
          onAccept?.();
        } else {
          setAcceptMsg('❌ Fehler beim Annehmen.');
          setTimeout(() => setAcceptMsg(''), 3000);
        }
      } catch {
        setAcceptMsg('❌ Netzwerkfehler.');
        setTimeout(() => setAcceptMsg(''), 3000);
      }
    };
    return () => { delete (window as any).__acceptMapItem; };
  }, [user, onAccept]);

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
      // Always show ALL unassigned/open orders regardless of date so employees can see and claim them
      const unassignedFiltered = unassigned;

      if (filterDate) {
        mineFiltered = mine.filter(a => a.scheduled_at?.includes(filterDate));
      }

      const all: Array<{ a: MapAssignment; color: string; isAssigned: boolean }> = [];

      mineFiltered.forEach(a => {
        const isAssigned = !!a.assigned_user_id;
        all.push({ a, color: isAssigned ? '#22c55e' : '#eab308', isAssigned });
      });

      unassignedFiltered.forEach(a => {
        if (!all.some(item => item.a.id === a.id)) {
          all.push({ a, color: '#eab308', isAssigned: false });
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
      cached.forEach(({ a, color, isAssigned }) => {
        const coords = geoCache[a.customer.address];
        const marker = L.marker(coords, { icon: makePin(color) })
          .addTo(mapInstance.current)
          .bindPopup(makeAssignmentPopupHtml(a, isAssigned, !!user && !isAssigned), { maxWidth: 260 });
        markers.current.push(marker);
      });

      if (needsGeocode.length === 0) {
        setStatus('');
        if (cached.length > 0 && cached.length < 5) mapInstance.current.setView(geoCache[cached[0].a.customer.address], 12);
        return;
      }

      // Process non-cached with delay
      let done = 0;
      needsGeocode.forEach(async ({ a, color, isAssigned }, i) => {
        const address = a.customer.address;
        await new Promise(r => setTimeout(r, i * 1100)); // Respect Nominatim 1s limit

        const coords = await geocodeNominatim(address);
        done++;
        if (done >= needsGeocode.length) setStatus('');

        if (!coords || cancelled || !mapInstance.current) return;

        const marker = L.marker(coords, { icon: makePin(color) })
          .addTo(mapInstance.current)
          .bindPopup(makeAssignmentPopupHtml(a, isAssigned, !!user && !isAssigned), { maxWidth: 260 });
        markers.current.push(marker);

        if (cached.length === 0 && i === 0) {
          mapInstance.current.setView(coords, 12);
        }
      });
    }).catch(e => setStatus(e.message));
    return () => { cancelled = true; };
  }, [mine, unassigned, filterDate, user]);

  return (
    <div>
      {acceptMsg && <div className={`msg-banner ${acceptMsg.startsWith('❌') ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: '8px' }}>{acceptMsg}</div>}
      {status && <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0' }}>{status}</p>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '0.85rem' }}>
        <span>🟡 Offen / Anfragen ({unassigned.length})</span>
        <span>🟢 Zugewiesen ({mine.length})</span>
        {filterDate && <span style={{ fontWeight: 'bold', color: '#00454A' }}>📅 Meine Termine: {filterDate}</span>}
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

function AssignmentsAdminTab({ canDelete }: { canDelete: boolean }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [form, setForm] = useState<any>({ customer_id: '', assigned_user_id: '', title: '', description: '', scheduled_at: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);

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

  const deleteAssignment = (id: string, title: string) => {
    setConfirmDel({ id, title });
  };

  const confirmDelExecute = async () => {
    if (!confirmDel) return;
    const r = await fetch(`${API}/assignments/${confirmDel.id}`, { method: 'DELETE', headers: authHeaders() });
    setConfirmDel(null);
    if (r.ok) {
      setMsg('✅ Auftrag gelöscht.');
      setTimeout(() => setMsg(''), 3000);
      load();
    } else {
      setMsg('❌ Löschen fehlgeschlagen.');
    }
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

  const now2 = new Date();
  const todayStr2 = now2.toISOString().slice(0, 10);
  const weekAgo2 = new Date(now2); weekAgo2.setDate(now2.getDate() - 7);
  const monthStart2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
  const fbtn2 = (active: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: '16px', cursor: 'pointer', fontSize: '0.82rem', background: active ? '#00454A' : 'white', color: active ? 'white' : '#374151', fontWeight: active ? 700 : 400 });

  const filteredAssignments = assignments
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .filter(a => {
      if (timeFilter === 'all') return true;
      if (timeFilter === 'today') return a.scheduled_at.startsWith(todayStr2);
      const d = new Date(a.scheduled_at);
      if (timeFilter === 'week') return d >= weekAgo2;
      if (timeFilter === 'month') return d >= monthStart2;
      return true;
    })
    .filter(a => !searchQ || `${a.title} ${a.customer?.first_name} ${a.customer?.last_name} ${a.customer?.address}`.toLowerCase().includes(searchQ.toLowerCase()));

  return (
    <div className="assignments-admin-layout" style={{ display: 'flex', gap: '24px' }}>
      {confirmDel && <ConfirmDialog message={`Auftrag "${confirmDel.title}" wirklich löschen? Alle zugehörigen Zeitnachweise und Berichte werden ebenfalls gelöscht.`} onConfirm={confirmDelExecute} onCancel={() => setConfirmDel(null)} />}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Auftragsübersicht ({filteredAssignments.length}/{assignments.length})</h3>
            <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? '× Abbrechen' : '+ Neuer Auftrag'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input type="search" placeholder="🔍 Suchen nach Titel, Kunde, Adresse…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['all','Alle'],['pending','Ausstehend'],['in_progress','In Bearbeitung'],['completed','Abgeschlossen'],['cancelled','Abgebrochen']].map(([v,l]) => (
                <button key={v} style={fbtn2(statusFilter === v)} onClick={() => setStatusFilter(v)}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['all','Alle Zeiten'],['today','Heute'],['week','Diese Woche'],['month','Dieser Monat']].map(([v,l]) => (
                <button key={v} style={fbtn2(timeFilter === v)} onClick={() => setTimeFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
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

        <div className="table-scroll-wrap">
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
              {canDelete && <th style={{ padding: '12px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Keine Aufträge für diesen Filter.</td></tr>}
            {filteredAssignments.map(a => (
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
                {canDelete && (
                  <td style={{ padding: '12px' }}>
                    <button className="btn-danger btn-sm btn-icon" onClick={() => deleteAssignment(a.id, a.title)} title="Auftrag löschen">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

// ── PDF download helper (auth-aware) ──────────────────────────────────────────

async function downloadReportPdf(reportId: string) {
  const r = await fetch(`/api/pdf/${reportId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  if (!r.ok) { alert('PDF konnte nicht geladen werden (' + r.status + ')'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'helferchen-bericht.pdf';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
}

// ── Kunden Tab ─────────────────────────────────────────────────────────────────

interface CustomerStats { total_revenue: number; open_amount: number; }

function KundenTab({ canDelete }: { canDelete: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [customerStats, setCustomerStats] = useState<Record<string, CustomerStats>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmDelReport, setConfirmDelReport] = useState<string | null>(null);
  const [confirmDelCustomer, setConfirmDelCustomer] = useState<Customer | null>(null);
  const [delMsg, setDelMsg] = useState('');

  const loadKunden = useCallback(async () => {
    const [cR, aR, rR, sR] = await Promise.all([
      fetch(`${API}/customers`, { headers: authHeaders() }),
      fetch(`${API}/assignments/all`, { headers: authHeaders() }),
      fetch(`${API}/reports`, { headers: authHeaders() }),
      fetch(`${API}/reports/customer-stats`, { headers: authHeaders() }),
    ]);
    if (cR.ok) setCustomers(await cR.json());
    if (aR.ok) setAssignments(await aR.json());
    if (rR.ok) setReports(await rR.json());
    if (sR.ok) setCustomerStats(await sR.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadKunden(); }, [loadKunden]);

  const deleteReport = (reportId: string) => {
    setConfirmDelReport(reportId);
  };

  const confirmDelReportExecute = async () => {
    if (!confirmDelReport) return;
    await fetch(`${API}/reports/${confirmDelReport}`, { method: 'DELETE', headers: authHeaders() });
    setConfirmDelReport(null);
    loadKunden();
  };

  const confirmDelCustomerExecute = async () => {
    if (!confirmDelCustomer) return;
    try {
      const r = await fetch(`${API}/customers/${confirmDelCustomer.id}`, { method: 'DELETE', headers: authHeaders() });
      setConfirmDelCustomer(null);
      if (r.ok) {
        setSelected(null);
        loadKunden();
      } else {
        const d = await r.json().catch(() => ({}));
        setDelMsg('❌ ' + (d.message || d.error || 'Löschen fehlgeschlagen'));
        setTimeout(() => setDelMsg(''), 5000);
      }
    } catch {
      setConfirmDelCustomer(null);
      setDelMsg('❌ Netzwerkfehler beim Löschen');
      setTimeout(() => setDelMsg(''), 5000);
    }
  };

  const getReport = (aid: string) => reports.find(r => r.assignment_id === aid);
  const customerAssignments = (cid: string) => assignments.filter(a => a.customer?.id === cid);

  const fbtn3 = (active: boolean): React.CSSProperties => ({ padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: '16px', cursor: 'pointer', fontSize: '0.82rem', background: active ? '#00454A' : 'white', color: active ? 'white' : '#374151', fontWeight: active ? 700 : 400 });

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.first_name} ${c.last_name} ${c.address}`.toLowerCase().includes(q);
  });

  if (loading) return <div className="loading-text">Lade Kunden…</div>;

  const detailAssignments = selected
    ? customerAssignments(selected.id).filter(a => statusFilter === 'all' || a.status === statusFilter).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    : [];

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexDirection: 'column' }}>
      {confirmDelReport && <ConfirmDialog message="Rechnung/Bericht wirklich löschen?" onConfirm={confirmDelReportExecute} onCancel={() => setConfirmDelReport(null)} />}
      {confirmDelCustomer && <ConfirmDialog message={`Kunde "${confirmDelCustomer.first_name} ${confirmDelCustomer.last_name}" und alle zugehörigen Aufträge, Berichte und Zeitnachweise unwiderruflich löschen? (DSGVO)`} onConfirm={confirmDelCustomerExecute} onCancel={() => setConfirmDelCustomer(null)} />}
      {delMsg && <div className={`msg-banner ${delMsg.startsWith('❌') ? 'msg-error' : 'msg-success'}`}>{delMsg}</div>}
    <div className="kunden-layout" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', width: '100%' }}>
      {/* List */}
      <div className="kunden-list-col" style={{ width: selected ? '340px' : '100%', flexShrink: 0 }}>
        <div style={{ marginBottom: '14px', display: 'flex', gap: '10px' }}>
          <input type="search" placeholder="🔍 Kunde suchen…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem' }} />
        </div>
        <table className="admin-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Kunde</th>
              {!selected && <th style={{ padding: '10px 12px', textAlign: 'left' }}>Adresse</th>}
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aufträge</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Umsatz</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Offen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>Keine Kunden gefunden.</td></tr>}
            {filtered.map(c => {
              const cas = customerAssignments(c.id);
              const stats = customerStats[c.id];
              const totalRevenue = stats?.total_revenue ?? 0;
              const openAmount = stats?.open_amount ?? 0;
              const isSel = selected?.id === c.id;
              return (
                <tr key={c.id} onClick={() => setSelected(isSel ? null : c)}
                  style={{ cursor: 'pointer', background: isSel ? '#F0FDF4' : undefined, borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
                    {c.phone_number && <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>📞 {c.phone_number}</div>}
                    {selected && <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>{c.address}</div>}
                  </td>
                  {!selected && <td style={{ padding: '12px', fontSize: '0.88rem', color: '#374151' }}>{c.address}</td>}
                  <td style={{ padding: '12px', textAlign: 'center', color: '#374151' }}>{cas.length}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {totalRevenue > 0
                      ? <span style={{ fontWeight: 600, color: '#16A34A' }}>{totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {openAmount > 0
                      ? <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700 }}>{openAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      : <span style={{ color: '#9CA3AF' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flex: 1, background: '#F9FAFB', borderRadius: '10px', padding: '20px', border: '1px solid #E5E7EB', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{selected.first_name} {selected.last_name}</h3>
              <p style={{ margin: '0 0 2px', color: '#6B7280', fontSize: '0.88rem' }}>📍 {selected.address}</p>
              {selected.phone_number && <p style={{ margin: 0, color: '#6B7280', fontSize: '0.88rem' }}>📞 {selected.phone_number}</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {canDelete && (
                <button onClick={() => setConfirmDelCustomer(selected)}
                  style={{ padding: '5px 12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  title="Kunde löschen (DSGVO)">
                  🗑 Löschen
                </button>
              )}
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Filters inside detail */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[['all','Alle'],['pending','Ausstehend'],['in_progress','In Bearbeitung'],['completed','Abgeschlossen']].map(([v,l]) => (
              <button key={v} style={fbtn3(statusFilter === v)} onClick={() => setStatusFilter(v)}>{l}</button>
            ))}
          </div>

          {detailAssignments.length === 0 ? (
            <p style={{ color: '#9CA3AF' }}>Keine Aufträge für diesen Filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {detailAssignments.map(a => {
                const rep = getReport(a.id);
                const borderColor = a.status === 'completed' ? '#22C55E' : a.status === 'in_progress' ? '#F59E0B' : '#D1D5DB';
                return (
                  <div key={a.id} style={{ background: 'white', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${borderColor}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.97rem' }}>{a.title}</strong>
                      <span className={`status-badge status-${a.status}`}>{statusLabel(a.status)}</span>
                    </div>
                    <p style={{ margin: '0 0 4px', color: '#6B7280', fontSize: '0.82rem' }}>
                      📅 {new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} Uhr
                      {a.assigned_user && ` · 👤 ${a.assigned_user.full_name}`}
                    </p>
                    {rep ? (
                      <div style={{ background: '#F3F4F6', borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rep.notes ? '6px' : 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: rep.signature_id ? '#16A34A' : '#DC2626' }}>
                            {rep.signature_id ? '✅ Bezahlt / Unterschrieben' : '❗ Offene Rechnung'}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => downloadReportPdf(rep.id)}
                              style={{ fontSize: '0.78rem', padding: '3px 10px', background: '#00454A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              📄 PDF herunterladen
                            </button>
                            {canDelete && (
                              <button onClick={() => deleteReport(rep.id)}
                                style={{ fontSize: '0.78rem', padding: '3px 10px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                title="Rechnung löschen">
                                ✕ Löschen
                              </button>
                            )}
                          </div>
                        </div>
                        {rep.notes && <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.45 }}>{rep.notes.length > 120 ? rep.notes.slice(0, 120) + '…' : rep.notes}</p>}
                      </div>
                    ) : (
                      <p style={{ margin: '8px 0 0', color: '#9CA3AF', fontSize: '0.8rem' }}>Kein Bericht vorhanden.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// ── Anrufagent Tab ─────────────────────────────────────────────────────────────

const QUICK_SERVICES = [
  'Einkaufshilfe', 'Reinigung', 'Gartenarbeit', 'Fahrdienst',
  'Begleitung', 'Haushaltsunterstützung', 'Behördengänge', 'Sonstiges',
];

function AnrufagentTab({ user }: { user: User }) {
  // ── Missed calls ────────────────────────────────────────────────────────────
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLogsLoading, setCallLogsLoading] = useState(true);
  const [callbackMsg, setCallbackMsg] = useState('');
  const [callbackBusy, setCallbackBusy] = useState<string | null>(null);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [noteSaving, setNoteSaving] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'booking' | 'missed'>('booking');

  const loadCallLogs = useCallback(async () => {
    const r = await fetch(`${API}/calls`, { headers: authHeaders() }).catch(() => null);
    if (r?.ok) setCallLogs(await r.json());
    setCallLogsLoading(false);
  }, []);

  useEffect(() => {
    loadCallLogs();
    const iv = setInterval(loadCallLogs, 30000);
    return () => clearInterval(iv);
  }, [loadCallLogs]);

  const missedCount = callLogs.filter(c => c.status === 'missed').length;

  const markHandled = async (id: string) => {
    await fetch(`${API}/calls/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'handled' }) });
    loadCallLogs();
  };

  const saveNote = async (id: string) => {
    setNoteSaving(id);
    await fetch(`${API}/calls/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ note: noteValues[id] || '' }) });
    setNoteSaving(null);
    loadCallLogs();
  };

  const triggerCallback = async (callId: string, callerNum: string) => {
    setCallbackBusy(callId);
    setCallbackMsg('');
    const r = await fetch(`${API}/calls/${callId}/callback`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({}),
    }).catch(() => null);
    if (r?.ok) {
      setCallbackMsg(`✅ Linphone klingelt – nach Abheben wird ${callerNum} verbunden.`);
      loadCallLogs();
    } else {
      const d = await r?.json().catch(() => ({}));
      setCallbackMsg('❌ ' + (d?.error || 'Rückruf fehlgeschlagen'));
    }
    setCallbackBusy(null);
  };

  // ── Booking form ────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [customerFound, setCustomerFound] = useState<Customer | null>(null);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display: string; short: string }>>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressWrapRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T09:00`;
  });
  const [assignedUserId, setAssignedUserId] = useState('');

  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/assignments/employees`, { headers: authHeaders() })
      .then(r => r.json()).then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addressWrapRef.current && !addressWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const lookupByPhone = async (overridePhone?: string) => {
    const num = (overridePhone ?? phone).trim();
    if (!num) return;
    setPhone(num);
    setCustomerSearching(true);
    setCustomerSearchDone(false);
    setCustomerFound(null);
    setIsNewCustomer(false);
    try {
      const r = await fetch(`${API}/customers`, { headers: authHeaders() });
      const customers: Customer[] = r.ok ? await r.json() : [];
      const normalized = num.replace(/[\s\-\(\)\+]/g, '');
      const found = customers.find(c =>
        c.phone_number?.replace(/[\s\-\(\)\+]/g, '') === normalized
      );
      if (found) {
        setCustomerFound(found);
        setFirstName(found.first_name);
        setLastName(found.last_name);
        setAddress(found.address);
        setEmail(found.email || '');
        setIsNewCustomer(false);
      } else {
        setIsNewCustomer(true);
        setFirstName('');
        setLastName('');
        setAddress('');
        setEmail('');
      }
    } finally {
      setCustomerSearching(false);
      setCustomerSearchDone(true);
    }
  };

  function formatNominatimAddress(item: any): string {
    const a = item.address || {};
    const parts: string[] = [];
    if (a.road) parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
    if (a.postcode || a.city || a.town || a.village || a.municipality) {
      const city = a.city || a.town || a.village || a.municipality || '';
      parts.push(a.postcode ? `${a.postcode} ${city}`.trim() : city);
    }
    return parts.join(', ') || item.display_name;
  }

  const handleAddressInput = (value: string) => {
    setAddress(value);
    setShowSuggestions(false);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (value.length < 3) { setAddressSuggestions([]); return; }
    addressDebounceRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=6&countrycodes=de&addressdetails=1`;
        const r = await fetch(url, { headers: { 'Accept-Language': 'de' } });
        const data: any[] = await r.json();
        const suggestions = data.map(d => ({ display: formatNominatimAddress(d), short: d.display_name }));
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setAddressLoading(false);
      }
    }, 450);
  };

  const selectSuggestion = (s: { display: string; short: string }) => {
    setAddress(s.display);
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const resetForm = () => {
    setPhone('');
    setCustomerFound(null);
    setCustomerSearchDone(false);
    setIsNewCustomer(false);
    setFirstName(''); setLastName(''); setAddress(''); setEmail('');
    setTitle(''); setDescription(''); setAssignedUserId('');
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    setScheduledAt(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T09:00`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setMsg('❌ Bitte einen Titel/Dienstleistung eingeben.'); return; }
    if (!address.trim()) { setMsg('❌ Bitte eine Adresse eingeben.'); return; }
    setSaving(true); setMsg('');
    try {
      let customerId = customerFound?.id;
      if (!customerId) {
        const cRes = await fetch(`${API}/customers`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), address: address.trim(), phone_number: phone.trim(), notes: email.trim() }),
        });
        if (!cRes.ok) {
          const d = await cRes.json().catch(() => ({}));
          setMsg('❌ Fehler beim Anlegen des Kunden: ' + (d.message || ''));
          return;
        }
        customerId = (await cRes.json()).id;
      }
      const aRes = await fetch(`${API}/assignments`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ customer_id: customerId, assigned_user_id: assignedUserId || null, title: title.trim(), description: description.trim(), scheduled_at: scheduledAt }),
      });
      if (aRes.ok) {
        setMsg('✅ Auftrag erfolgreich eingebucht!');
        setTimeout(() => { setMsg(''); resetForm(); }, 2500);
      } else {
        const d = await aRes.json().catch(() => ({}));
        setMsg('❌ Fehler: ' + (d.message || 'Auftrag konnte nicht gespeichert werden.'));
      }
    } catch { setMsg('❌ Netzwerkfehler. Bitte Verbindung prüfen.'); }
    finally { setSaving(false); }
  };

  const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', background: '#fff' };
  const labelSt: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' };
  const fieldSt: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };

  const statusLabel: Record<string, string> = {
    missed: 'Verpasst',
    answered: 'Angenommen',
    callback_initiated: 'Rückruf läuft',
    handled: 'Erledigt',
  };
  const statusColor: Record<string, string> = {
    missed: '#DC2626',
    answered: '#16A34A',
    callback_initiated: '#D97706',
    handled: '#6B7280',
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '8px 0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #00454A 0%, #006B72 100%)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px', color: 'white' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.4rem' }}>📞 Anrufagent</h2>
        <p style={{ margin: 0, opacity: 0.85, fontSize: '0.92rem' }}>Kunden direkt beim Anruf einbuchen – schnell und fehlerfrei.</p>
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveView('booking')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', background: activeView === 'booking' ? '#00454A' : '#E5E7EB', color: activeView === 'booking' ? 'white' : '#374151' }}
        >
          📋 Auftrag einbuchen
        </button>
        <button
          onClick={() => setActiveView('missed')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', background: activeView === 'missed' ? '#DC2626' : '#E5E7EB', color: activeView === 'missed' ? 'white' : '#374151', position: 'relative' }}
        >
          📵 Verpasste Anrufe
          {missedCount > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#DC2626', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, border: '2px solid white' }}>
              {missedCount > 9 ? '9+' : missedCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Missed calls view ─────────────────────────────────────────── */}
      {activeView === 'missed' && (
        <div>
          {callbackMsg && (
            <div style={{ background: callbackMsg.startsWith('❌') ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${callbackMsg.startsWith('❌') ? '#FCA5A5' : '#86EFAC'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: callbackMsg.startsWith('❌') ? '#DC2626' : '#16A34A', fontWeight: 600 }}>{callbackMsg}</p>
            </div>
          )}

          {callLogsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Lade Anrufliste…</div>
          ) : callLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📭</div>
              <p style={{ fontSize: '1rem' }}>Noch keine Anrufe aufgezeichnet.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Anrufe erscheinen hier sobald Asterisk aktiv ist und ein Anruf verpasst wurde.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {callLogs.map(call => (
                <div key={call.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px 20px', border: `1.5px solid ${call.status === 'missed' ? '#FCA5A5' : '#E5E7EB'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{call.status === 'missed' ? '📵' : call.status === 'callback_initiated' ? '🔄' : '✅'}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>{call.caller_id}</div>
                        <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>{new Date(call.created_at).toLocaleString('de-DE')}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, background: `${statusColor[call.status]}20`, color: statusColor[call.status] }}>
                        {statusLabel[call.status] || call.status}
                      </span>
                      {call.status === 'missed' && (
                        <>
                          <button
                            onClick={() => { setActiveView('booking'); lookupByPhone(call.caller_id); }}
                            style={{ padding: '5px 12px', fontSize: '0.82rem', background: '#00454A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            📋 Einbuchen
                          </button>
                          <button
                            onClick={() => triggerCallback(call.id, call.caller_id)}
                            disabled={callbackBusy === call.id}
                            style={{ padding: '5px 12px', fontSize: '0.82rem', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: callbackBusy === call.id ? 0.6 : 1 }}
                          >
                            {callbackBusy === call.id ? '⏳…' : '📲 Rückruf'}
                          </button>
                          <button
                            onClick={() => markHandled(call.id)}
                            style={{ padding: '5px 12px', fontSize: '0.82rem', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Erledigt
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Gesprächsnotiz */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                    <label style={{ ...labelSt, marginBottom: '6px' }}>Gesprächsnotiz</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <textarea
                        rows={2}
                        style={{ ...inputSt, resize: 'vertical', minHeight: '52px', fontFamily: 'inherit', fontSize: '0.88rem', flex: 1 }}
                        placeholder="Kurze Notiz zum Anruf…"
                        value={noteValues[call.id] ?? (call.note || '')}
                        onChange={e => setNoteValues(prev => ({ ...prev, [call.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => saveNote(call.id)}
                        disabled={noteSaving === call.id}
                        style={{ padding: '8px 14px', background: '#00454A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: noteSaving === call.id ? 0.6 : 1 }}
                      >
                        {noteSaving === call.id ? '…' : 'Speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Booking form view ─────────────────────────────────────────── */}
      {activeView === 'booking' && (
        <>
          {msg && (
            <div className={`msg-banner ${msg.startsWith('❌') ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: '16px', borderRadius: '8px' }}>
              {msg}
            </div>
          )}

          {/* Step 1: Phone */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1.5px solid #E5E7EB', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00454A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>1</div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Telefonnummer des Anrufers</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="tel"
                placeholder="+49 123 456789"
                value={phone}
                onChange={e => { setPhone(e.target.value); setCustomerSearchDone(false); setCustomerFound(null); setIsNewCustomer(false); }}
                onKeyDown={e => e.key === 'Enter' && lookupByPhone()}
                style={{ ...inputSt, flex: 1 }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => lookupByPhone()}
                disabled={!phone.trim() || customerSearching}
                style={{ padding: '10px 18px', background: '#00454A', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap', opacity: !phone.trim() ? 0.5 : 1 }}
              >
                {customerSearching ? '...' : '🔍 Suchen'}
              </button>
            </div>
            {customerSearchDone && customerFound && (
              <div style={{ marginTop: '10px', padding: '10px 14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>✅</span>
                <div>
                  <span style={{ fontWeight: 700, color: '#15803D' }}>Bekannter Kunde gefunden: </span>
                  <span style={{ color: '#1F2937' }}>{customerFound.first_name} {customerFound.last_name}</span>
                  <span style={{ color: '#6B7280', fontSize: '0.85rem', marginLeft: '8px' }}>{customerFound.address}</span>
                </div>
              </div>
            )}
            {customerSearchDone && isNewCustomer && (
              <div style={{ marginTop: '10px', padding: '10px 14px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🆕</span>
                <span style={{ color: '#92400E', fontWeight: 600 }}>Nummer nicht gefunden – neuer Kunde wird angelegt.</span>
              </div>
            )}
          </div>

          {/* Step 2: Customer data */}
          {(customerFound || isNewCustomer) && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1.5px solid #E5E7EB', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00454A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>2</div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Kundendaten</h3>
                {customerFound && <span style={{ fontSize: '0.78rem', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Vorausgefüllt</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div style={fieldSt}>
                  <label style={labelSt}>Vorname *</label>
                  <input style={inputSt} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Max" disabled={!!customerFound} required />
                </div>
                <div style={fieldSt}>
                  <label style={labelSt}>Nachname *</label>
                  <input style={inputSt} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Mustermann" disabled={!!customerFound} required />
                </div>
              </div>

              <div style={{ ...fieldSt, marginBottom: '14px' }}>
                <label style={labelSt}>E-Mail (optional)</label>
                <input style={inputSt} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="max@beispiel.de" disabled={!!customerFound} />
              </div>

              <div style={fieldSt} ref={addressWrapRef}>
                <label style={labelSt}>
                  Adresse *
                  {addressLoading && <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: '8px', fontSize: '0.8rem' }}>Suche…</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputSt, paddingRight: addressLoading ? '36px' : '12px', borderColor: showSuggestions ? '#00454A' : '#D1D5DB' }}
                    value={address}
                    onChange={e => handleAddressInput(e.target.value)}
                    onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Musterstraße 1, 12345 Berlin"
                    autoComplete="off"
                  />
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1.5px solid #00454A', borderTop: 'none', borderRadius: '0 0 8px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '220px', overflowY: 'auto' }}>
                      {addressSuggestions.map((s, i) => (
                        <div
                          key={i}
                          onMouseDown={() => selectSuggestion(s)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < addressSuggestions.length - 1 ? '1px solid #F3F4F6' : 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>📍 {s.display}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>Tipp: Straße + Hausnummer + Ort eingeben – Vorschläge erscheinen automatisch.</p>
              </div>
            </div>
          )}

          {/* Step 3: Assignment */}
          {(customerFound || isNewCustomer) && (
            <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1.5px solid #E5E7EB', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00454A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>3</div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Auftragsdetails</h3>
              </div>

              <div style={{ ...fieldSt, marginBottom: '14px' }}>
                <label style={labelSt}>Dienstleistung / Titel *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {QUICK_SERVICES.map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => setTitle(s)}
                      style={{ padding: '5px 12px', border: `1.5px solid ${title === s ? '#00454A' : '#D1D5DB'}`, borderRadius: '16px', cursor: 'pointer', fontSize: '0.82rem', background: title === s ? '#00454A' : '#fff', color: title === s ? '#fff' : '#374151', fontWeight: title === s ? 700 : 400, transition: 'all 0.15s' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input style={inputSt} value={title} onChange={e => setTitle(e.target.value)} placeholder="Oder eigenen Titel eingeben…" required />
              </div>

              <div style={{ ...fieldSt, marginBottom: '14px' }}>
                <label style={labelSt}>Beschreibung / Notizen</label>
                <textarea
                  style={{ ...inputSt, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Details zum Auftrag, besondere Wünsche des Kunden…"
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div style={fieldSt}>
                  <label style={labelSt}>Datum & Uhrzeit *</label>
                  <input style={inputSt} type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required />
                </div>
                <div style={fieldSt}>
                  <label style={labelSt}>Mitarbeiter zuweisen</label>
                  <select style={{ ...inputSt, cursor: 'pointer' }} value={assignedUserId} onChange={e => setAssignedUserId(e.target.value)}>
                    <option value="">– Noch nicht zuweisen –</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !address.trim() || (!customerFound && (!firstName.trim() || !lastName.trim()))}
                  style={{ flex: 1, padding: '14px', background: '#00454A', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}
                >
                  {saving ? '⏳ Wird eingebucht…' : '✅ Auftrag einbuchen'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ padding: '14px 20px', background: '#fff', color: '#6B7280', border: '1.5px solid #D1D5DB', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
                >
                  Zurücksetzen
                </button>
              </div>
            </form>
          )}

          {!customerFound && !isNewCustomer && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📞</div>
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>Telefonnummer eingeben und auf Suchen klicken, um zu starten.</p>
            </div>
          )}
        </>
      )}
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
  const canDelete = isAdmin;
  const tabs: { id: Tab; label: string; requireAdmin?: boolean; requireRoles?: string[] }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'anruf', label: '📞 Anrufagent', requireRoles: ['admin', 'kundenbetreuer'] },
    { id: 'appointments', label: '📅 Termine' },
    { id: 'tour', label: '🗺️ Tour' },
    { id: 'booking-requests', label: '📬 Anfragen', requireAdmin: true },
    { id: 'timelogs', label: '⏱ Zeiten' },
    { id: 'employees', label: '👥 Mitarbeiter', requireAdmin: true },
    { id: 'assignments-admin', label: '🧾 Aufträge', requireAdmin: true },
    { id: 'kunden', label: '👥 Kunden', requireAdmin: true },
  ];

  return (
    <div className="portal-layout">
      <div className="portal-header-wrap">
        <header className="portal-header">
          <div className="portal-header-left">
            <img src="/logo.png" alt="Helferchen" style={{ height: '40px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            <span className="portal-user">Angemeldet als <strong>{user?.full_name}</strong></span>
          </div>
        </header>

        <div className="portal-action-bar">
          <div className="portal-action-left">
            <button className="btn-action-outline" onClick={() => window.open('/app', '_blank')}>
              App starten
            </button>
            <button className="btn-action-outline" onClick={handleInstallApp}>
              App installieren
            </button>
            <button className="btn-action-outline" onClick={handleOrderMarketing}>
              Werbematerial bestellen
            </button>
            <button className="btn-action-logout" onClick={() => { localStorage.clear(); navigate('/'); }}>
              &#x2192; Abmelden
            </button>
          </div>
          {isAdmin && (
            <button className="btn-action-settings" onClick={() => navigate('/admin')} title="Admin-Einstellungen">
              ⚙
            </button>
          )}
        </div>
      </div>

      <nav className="portal-tabs">
        {tabs.filter(t => {
          if (t.requireRoles) return t.requireRoles.includes(user.role);
          if (t.requireAdmin) return isAdmin;
          return true;
        }).map(t => (
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
            {activeTab === 'anruf' && (isAdmin || user.role === 'kundenbetreuer') && <AnrufagentTab user={user} />}
            {activeTab === 'appointments' && <AppointmentsTab assignments={assignments} onRefresh={loadData} canDelete={canDelete} />}
            {activeTab === 'tour' && (
              <div>
                <TourTab assignments={assignments} unassigned={unassignedAssignments} selectedDate={selectedDate} setSelectedDate={setSelectedDate} user={user} />
                <h3 style={{ margin: '24px 0 12px' }}>Kartenansicht (OpenStreetMap)</h3>
                <OsmMapView mine={assignments} unassigned={unassignedAssignments} filterDate={selectedDate} user={user ?? undefined} onAccept={loadData} />
              </div>
            )}
            {activeTab === 'booking-requests' && isAdmin && <BookingRequestsTab canDelete={canDelete} />}
            {activeTab === 'timelogs' && <TimelogsTab timelogs={timelogs} assignments={assignments} />}
            {activeTab === 'employees' && isAdmin && <EmployeesTab />}
            {activeTab === 'assignments-admin' && isAdmin && <AssignmentsAdminTab canDelete={canDelete} />}
            {activeTab === 'kunden' && isAdmin && <KundenTab canDelete={canDelete} />}
          </>
        )}
      </main>
    </div>
  );
}
