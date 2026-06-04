import { useEffect, useState } from 'react';
import { adminApi, User } from './api';

export default function Employees() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'employee', email: '', full_name: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => adminApi.getUsers().then(setUsers).catch(e => setError(e.message));

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

  return (
    <div>
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
              <option value="employee">Mitarbeiter</option>
              <option value="admin">Admin</option>
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
            <th>Erstellt</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.username}</td>
              <td><span className={`badge badge--${u.role}`}>{u.role}</span></td>
              <td>{u.email}</td>
              <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
              <td>
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
