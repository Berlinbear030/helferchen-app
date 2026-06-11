import { useEffect, useState } from 'react';
import { adminApi, User, Role, EmployeeStats } from './api';

type EditForm = {
  full_name: string;
  email: string;
  role: string;
  address: string;
  qualification: string;
  password: string;
};

const emptyEdit = (): EditForm => ({ full_name: '', email: '', role: 'employee', address: '', qualification: '', password: '' });

function formatDuration(minutes: number | null): string {
  if (!minutes) return '–';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function StatsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getUserStats(user.id)
      .then(setStats)
      .catch(e => setError(e.message));
  }, [user.id]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 780, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Statistik: {user.full_name}</h3>
          <button className="btn-danger-sm" onClick={onClose}>✕</button>
        </div>

        {error && <p className="error">{error}</p>}
        {!stats && !error && <p>Lade...</p>}

        {stats && (
          <>
            <div className="admin-stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-value">{stats.total_assignments}</div>
                <div className="stat-label">Aufträge gesamt</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.completed_assignments}</div>
                <div className="stat-label">Abgeschlossen</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.total_timelogs}</div>
                <div className="stat-label">Zeiterfassungen</div>
              </div>
              <div className="stat-card stat-card--highlight">
                <div className="stat-value">{stats.total_earnings.toFixed(2)} €</div>
                <div className="stat-label">Verdient gesamt</div>
              </div>
            </div>

            <h4 style={{ marginBottom: '0.5rem' }}>Zeiterfassungen</h4>
            {stats.timelogs.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.875rem' }}>Keine Zeiterfassungen vorhanden.</p>
            ) : (
              <table className="admin-table" style={{ marginBottom: '1.5rem' }}>
                <thead>
                  <tr>
                    <th>Auftrag</th>
                    <th>Kunde</th>
                    <th>Start</th>
                    <th>Ende</th>
                    <th>Dauer</th>
                    <th>Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.timelogs.map(t => (
                    <tr key={t.id}>
                      <td>{t.assignment_title ?? '–'}</td>
                      <td>{t.customer_name ?? '–'}</td>
                      <td>{formatDate(t.start_time)}</td>
                      <td>{formatDate(t.end_time)}</td>
                      <td>{formatDuration(t.duration_minutes)}</td>
                      <td>{t.total_price != null ? `${Number(t.total_price).toFixed(2)} €` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4 style={{ marginBottom: '0.5rem' }}>Aufträge</h4>
            {stats.assignments.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.875rem' }}>Keine Aufträge vorhanden.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th>Kunde</th>
                    <th>Geplant</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.assignments.map(a => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.customer_name ?? '–'}</td>
                      <td>{formatDate(a.scheduled_at)}</td>
                      <td><span className={`badge badge--${a.status === 'completed' ? 'success' : a.status === 'cancelled' ? 'high' : 'neutral'}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EditModal({ user, roles, onClose, onSaved }: { user: User; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EditForm>({
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'employee',
    address: user.address ?? '',
    qualification: user.qualification ?? '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data: Parameters<typeof adminApi.updateUser>[1] = {
        full_name: form.full_name || undefined,
        email: form.email || undefined,
        role: form.role || undefined,
        address: form.address,
        qualification: form.qualification,
      };
      if (form.password) data.password = form.password;
      await adminApi.updateUser(user.id, data);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Mitarbeiter bearbeiten</h3>
          <button className="btn-danger-sm" onClick={onClose}>✕</button>
        </div>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label>Benutzername (nicht änderbar)</label>
            <input disabled value={user.username} style={{ background: '#f1f3f5', color: '#888' }} />
          </div>
          <div className="form-row">
            <label>Vollständiger Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>E-Mail</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Rolle</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {roles.map(r => (
                <option key={r.id} value={r.name}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Adresse</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Straße, PLZ Ort" />
          </div>
          <div className="form-row">
            <label>Qualifikation</label>
            <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="z.B. Pflegehelfer, Reinigungskraft" />
          </div>
          <div className="form-row">
            <label>Neues Passwort (leer lassen = nicht ändern)</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Speichern...' : 'Speichern'}
            </button>
            <button type="button" className="btn-danger-sm" onClick={onClose} style={{ padding: '0.4rem 0.75rem' }}>
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '1.5rem',
  width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

export default function Employees() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'employee', email: '', full_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statsUser, setStatsUser] = useState<User | null>(null);

  const load = () => Promise.all([
    adminApi.getUsers().then(setUsers),
    adminApi.getRoles().then(setRoles),
  ]).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminApi.createUser(form);
      setForm({ username: '', password: '', role: 'employee', email: '', full_name: '' });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
    try {
      await adminApi.deleteUser(id);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const getRoleLabel = (roleName: string) => {
    const r = roles.find(r => r.name === roleName);
    return r ? r.display_name : roleName;
  };

  return (
    <div>
      {editingUser && (
        <EditModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSaved={load}
        />
      )}
      {statsUser && (
        <StatsModal user={statsUser} onClose={() => setStatsUser(null)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Mitarbeiter</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : '+ Neu'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="admin-form" onSubmit={handleCreate}>
          <h3>Neuen Benutzer anlegen</h3>
          <div className="form-row">
            <label>Benutzername *</label>
            <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Passwort *</label>
            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Rolle *</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {roles.map(r => (
                <option key={r.id} value={r.name}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Vollständiger Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>E-Mail</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Speichern...' : 'Anlegen'}
          </button>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Benutzername</th>
            <th>Rolle</th>
            <th>E-Mail</th>
            <th>Qualifikation</th>
            <th>Erstellt</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.username}</td>
              <td>
                <span className={`badge badge--${u.role}`}>{getRoleLabel(u.role)}</span>
              </td>
              <td>{u.email}</td>
              <td>{u.qualification || <span style={{ color: '#aaa' }}>–</span>}</td>
              <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
              <td style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => setEditingUser(u)}
                >
                  Bearbeiten
                </button>
                <button
                  className="btn-danger-sm"
                  style={{ background: '#e0f2fe', color: '#0369a1' }}
                  onClick={() => setStatsUser(u)}
                >
                  Statistik
                </button>
                <button className="btn-danger-sm" onClick={() => handleDelete(u.id, u.username)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
